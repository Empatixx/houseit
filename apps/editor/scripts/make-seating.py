"""Blender 4.5: blender --background --python apps/editor/scripts/make-seating.py.

Metres; +Y is the front (glTF -Z). Cushions are sewn, boxed panels with
compressed seams, inflated faces and deterministic tension folds, not bevelled cubes.
"""
import bpy
import bmesh
import importlib.util
import math
import random
import sys
from pathlib import Path
from mathutils import Vector, Matrix
import numpy as np

sys.dont_write_bytecode=True
ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / 'apps/editor/public/models'
SOURCE = ROOT / 'assets/seating'
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# A small, seamless woven textile tile. UVs are in metres, tiled every 32 mm.
N = 256
rng = np.random.default_rng(47)
y, x = np.mgrid[0:N, 0:N]
warp = np.sin(2 * np.pi * x / 8)
weft = np.sin(2 * np.pi * y / 8)
weave = .045 * warp + .045 * weft + .025 * warp * weft + rng.normal(0, .018, (N, N))

def texture(name, pixels, noncolor=False):
    im = bpy.data.images.new(name, width=N, height=N, alpha=True)
    if noncolor:
        im.colorspace_settings.name = 'Non-Color'
    im.pixels.foreach_set(pixels.astype(np.float32).ravel())
    im.update()
    im.pack()
    return im

rgba = np.ones((N, N, 4))
rgba[:, :, :3] = np.clip(.82 + weave[:, :, None], 0, 1)
color_image = texture('Woven upholstery · colour', rgba)
gy, gx = np.gradient(weave)
normal = np.stack([-gx * 3, -gy * 3, np.ones((N, N))], axis=-1)
normal /= np.linalg.norm(normal, axis=-1)[:, :, None]
rgba[:, :, :3] = normal * .5 + .5
normal_image = texture('Woven upholstery · normal', rgba, True)

fabric = bpy.data.materials.new('body')
fabric.use_nodes = True
nodes = fabric.node_tree.nodes
links = fabric.node_tree.links
bsdf = nodes.get('Principled BSDF')
bsdf.inputs['Roughness'].default_value = .91
bsdf.inputs['Sheen Weight'].default_value = 0
bsdf.inputs['Sheen Roughness'].default_value = .8
tex = nodes.new('ShaderNodeTexImage')
tex.image = color_image
# Neutral texture permits the app's surface colour to tint the entire upholstery.
links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
texn = nodes.new('ShaderNodeTexImage')
texn.image = normal_image
normal_node = nodes.new('ShaderNodeNormalMap')
normal_node.inputs['Strength'].default_value = .32
links.new(texn.outputs['Color'], normal_node.inputs['Color'])
links.new(normal_node.outputs['Normal'], bsdf.inputs['Normal'])
feet = bpy.data.materials.new('feet')
feet.diffuse_color = (.025, .019, .015, 1)
feet.use_nodes = True
feet.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = feet.diffuse_color
feet.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value = .8

parts = []

def mesh(name, verts, faces, material=fabric):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    # Weld radial panel centres and recalculate outward normals; no degenerate fans.
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000001)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(data)
    bm.free()
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    data.materials.append(material)
    uv = data.uv_layers.new(name='Upholstery in metres')
    for poly in data.polygons:
        poly.use_smooth = True
        axis = max(range(3), key=lambda i: abs(poly.normal[i]))
        axes = [i for i in range(3) if i != axis]
        for li in poly.loop_indices:
            co = data.vertices[data.loops[li].vertex_index].co
            uv.data[li].uv = (co[axes[0]] / .032, co[axes[1]] / .032)
    parts.append(obj)
    return obj


def rounded_rect(w, d, r, count=80):
    # Arc-length samples also subdivide straight edges, so the fabric can inflate.
    perimeter = 2 * (w + d - 4 * r) + 2 * math.pi * r
    outline = []
    for i in range(count):
        s = i / count * perimeter
        for side in range(4):
            length = (w if side % 2 == 0 else d) - 2 * r
            if s <= length:
                if side == 0: p = (-w/2+r+s, -d/2)
                elif side == 1: p = (w/2, -d/2+r+s)
                elif side == 2: p = (w/2-r-s, d/2)
                else: p = (-w/2, d/2-r-s)
                break
            s -= length
            if s <= math.pi * r / 2:
                angle = -math.pi/2 + side * math.pi/2 + s/r
                cx = (w/2-r) * (1 if side < 2 else -1)
                cy = (d/2-r) * (-1 if side in (0,3) else 1)
                p = (cx+r*math.cos(angle), cy+r*math.sin(angle))
                break
            s -= math.pi*r/2
        outline.append(p)
    return outline


def piping(name, outline, z, transform, radius=.0013):
    verts, faces = [], []
    count = len(outline)
    for i, (x, y) in enumerate(outline):
        before, after = Vector((*outline[(i-1)%count],0)), Vector((*outline[(i+1)%count],0))
        tangent = (after-before).normalized()
        outward = Vector((tangent.y, -tangent.x, 0))
        for j in range(5):
            a = j * math.tau / 5
            v = Vector((x,y,z)) + radius * (math.cos(a)*outward + Vector((0,0,math.sin(a))))
            verts.append(transform(v))
    for i in range(count):
        for j in range(5):
            faces.append((i*5+j, ((i+1)%count)*5+j, ((i+1)%count)*5+(j+1)%5, i*5+(j+1)%5))
    mesh(name, verts, faces)


def cushion(name, w, d, h, location, angle=0, seed=1, back=False, loose=False, resolution=80):
    outline = rounded_rect(w, d, min(.045, w*.09), resolution)
    if loose:
        outline = [(x*(1-.10*math.cos(y/d*math.pi)), y*(1-.10*math.cos(x/w*math.pi))) for x,y in outline]
    count = len(outline)
    randomizer = random.Random(seed)
    folds = [(randomizer.uniform(0,math.tau), randomizer.uniform(.001,.003)) for _ in range(13)]
    c,s = math.cos(angle), math.sin(angle)
    def transform(v):
        return (v[0]+location[0], c*v[1]-s*v[2]+location[1], s*v[1]+c*v[2]+location[2])
    # Boxed sides, pinched stitched edges and a full crown across the whole panel.
    rings = [(0, -.37*h), (.2,-.38*h), (.5,-.39*h), (.8,-.38*h), (.96,-.32*h),
             (1,-.25*h), (1.004,-.17*h), (1.012,0), (1.003,.18*h), (1,.23*h),
             (.98,.27*h), (.94,.34*h), (.86,.44*h), (.74,.53*h), (.60,.59*h),
             (.44,.63*h), (.27,.655*h), (.12,.67*h), (0,.675*h)]
    if loose:
        rings=[(0,-.55*h),(.3,-.52*h),(.6,-.40*h),(.8,-.22*h),(.95,-.05*h),
               (1,0),(.95,.10*h),(.85,.32*h),(.7,.53*h),(.5,.68*h),(.25,.76*h),(0,.79*h)]
    verts=[]
    for scale,z in rings:
        for px,py in outline:
            theta = math.atan2(py/(d/2), px/(w/2))
            wrinkle = 0
            if scale > .55 and z > 0:
                for a,amp in folds:
                    delta = math.atan2(math.sin(theta-a),math.cos(theta-a))
                    # Narrow trough with soft shoulders, fading towards the centre.
                    width = .025 + .10*(1-scale)
                    wrinkle += amp * (1-2*(delta/width)**2)*math.exp(-(delta/width)**2) * math.exp(-((1-scale)/.22)**2)
            # Slightly relaxed upper edge, fuller centre, asymmetrical filling.
            relaxation = .0015 * math.sin(theta*3+seed) * scale**2
            zz = z + wrinkle + relaxation
            if z > .235*h and not loose:
                fullness=max(0,1-(px*scale/(w/2))**4)*max(0,1-(py*scale/(d/2))**4)
                zz=.235*h+.44*h*fullness**.60*min(1,(1-scale)/.035)+wrinkle+relaxation
            elif loose and z > 0:
                fullness=max(0,1-(px*scale/(w/2))**2)*max(0,1-(py*scale/(d/2))**2)
                zz=.79*h*fullness**.75*min(1,(1-scale)/.08)+wrinkle
            if back and z > .2*h:
                zz += .004*math.sin(theta+seed)*scale*(1-scale)
            verts.append(transform((px*scale,py*scale,zz)))
    faces=[]
    for j in range(len(rings)-1):
        for i in range(count):
            faces.append((j*count+i,j*count+(i+1)%count,(j+1)*count+(i+1)%count,(j+1)*count+i))
    # Reverse inward ring winding (bottom-to-top traversal).
    faces=[tuple(reversed(f)) for f in faces]
    obj=mesh(name,verts,faces)
    piping(name+' · upper stitched edge', outline,0 if loose else .235*h,transform)
    if not loose: piping(name+' · lower stitched edge', outline,-.25*h,transform,.0009)
    return obj


def block(name, size, location, radius=.018, material=fabric):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj=bpy.context.object
    obj.name=name
    obj.dimensions=size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel=obj.modifiers.new('Upholstered edge rounding','BEVEL')
    bevel.width=radius
    bevel.segments=5
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    weighted=obj.modifiers.new('Panel normals','WEIGHTED_NORMAL')
    weighted.keep_sharp=True
    bpy.ops.object.modifier_apply(modifier=weighted.name)
    obj.data.materials.append(material)
    for poly in obj.data.polygons: poly.use_smooth=True
    uv=obj.data.uv_layers.active or obj.data.uv_layers.new()
    for poly in obj.data.polygons:
        axis=max(range(3),key=lambda i:abs(poly.normal[i]))
        axes=[i for i in range(3) if i!=axis]
        for li in poly.loop_indices:
            v=obj.data.vertices[obj.data.loops[li].vertex_index].co
            uv.data[li].uv=(v[axes[0]]/.032,v[axes[1]]/.032)
    parts.append(obj)
    return obj


def beam(name, start, end, width, depth, radius=.006, material=feet):
    """Place a rail between its actual joints, including the buried ends."""
    a, b = Vector(start), Vector(end)
    obj = block(name, (width, depth, (b-a).length), (a+b)/2, radius, material)
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return obj


def seating(width,depth,seats,chaise=False):
    parts.clear()
    arm=(.24 if chaise else .18) if seats>1 else .16
    run=.95 if seats>1 else .84
    rear=-depth/2
    front=rear+run
    centre=(front+rear)/2
    inner=width-2*arm
    block('Upholstered base',(width-.025,run-.025,.265),(0,centre,.1675),.023)
    block('Structural back',(inner,.115,.65),(0,rear+.073,.355),.025)
    for sign in (-1,1):
        block('Upholstered arm',(arm,run,.51 if chaise else .665),(sign*(width-arm)/2,centre,.29 if chaise else .3675),.023 if chaise else .045)
        # Continuous sewn panel inset on the outer arm, visible at the front.
        armx=sign*(width-arm)/2
        line=rounded_rect(arm-.035,.465 if chaise else .61,.015)
        piping('Arm front panel seam',line,0,lambda v:(armx+v[0],front+.0005,(.289 if chaise else .3675)+v[1]),.0009)
        for yy in (rear+.12,front-.12):
            block('Recessed foot',(.075,.075,.034),(sign*(width/2-.14),yy,.017),.006,feet)
    gap=.009
    widths=([.89,(inner-.89)/2,(inner-.89)/2] if chaise else [inner/seats]*seats)
    left=-inner/2
    for i,span in enumerate(widths):
        xx=left+span/2
        left+=span
        end=depth/2 if chaise and i==0 else front
        start=rear+.205
        if chaise and i==0:
            block('Chaise upholstered base',(span-.007,depth-.028,.265),(xx,0,.1675),.023)
            for sign in (-1,1):
                block('Chaise recessed foot',(.075,.075,.034),(xx+sign*(span/2-.10),end-.12,.017),.006,feet)
        cushion('Seat '+str(i+1),span-gap,end-start-.012,.142 if chaise else .18,(xx,(start+end)/2,.353 if chaise else .34),seed=17+i)
        cushion('Back pillow '+str(i+1),span-gap,.435,.145,(xx,rear+.197,.597),angle=math.radians(-77),seed=38+i,back=True)
    if not chaise and seats>1:
        for side in (-1,1):
            loc=(side*(inner/2-.19),rear+.40,.52)
            before=len(parts)
            cushion('Loose scatter pillow',.32,.34,.135,loc,angle=math.radians(-68),seed=6+side,loose=True)
            turn=Matrix.Rotation(math.radians(side*16),4,'Y')
            for obj in parts[before:]:
                for v in obj.data.vertices: v.co=Vector(loc)+turn@(v.co-Vector(loc))
    return list(parts)


def tapered_leg(name,start,end,r1=.019,r2=.012,material=feet):
    a,b=Vector(start),Vector(end)
    bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=r1,radius2=r2,depth=(b-a).length,location=(a+b)/2)
    obj=bpy.context.object
    obj.name=name
    obj.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    obj.data.materials.append(material)
    for poly in obj.data.polygons: poly.use_smooth=True
    parts.append(obj)


def barrel_chair(width=.892,depth=.721):
    parts.clear()
    kx,ky=width/.892,depth/.721
    # A continuous upholstered horseshoe shell, softly channelled on the inside.
    verts,faces=[],[]
    steps,around=120,24
    for i in range(steps+1):
        t=-.61+(math.pi+1.22)*i/steps
        height=.665+.125*max(0,math.sin(t))
        bottom=.29
        phase=(i/steps*13)%1
        seam=.003*math.exp(-((min(phase,1-phase))/.075)**2)
        for j in range(around):
            a=j/around*math.tau
            # Squared ellipse cross-section has padded faces and generous rounded edges.
            radial=.053*math.copysign(abs(math.cos(a))**.55,math.cos(a))
            zz=(height+bottom)/2+(height-bottom)/2*math.copysign(abs(math.sin(a))**.33,math.sin(a))
            if radial<0: radial+=seam
            verts.append(((.393*kx+radial)*math.cos(t),-(.315*ky+radial)*math.sin(t),zz))
    for i in range(steps):
        for j in range(around):faces.append((i*around+j,(i+1)*around+j,(i+1)*around+(j+1)%around,i*around+(j+1)%around))
    faces += [tuple(reversed(range(around))),tuple(steps*around+j for j in range(around))]
    mesh('Curved channelled upholstered shell',verts,faces)
    block('Seat foundation',(.73*kx,.67*ky,.11),(0,.018*ky,.305),.048)
    cushion('Full rounded seat',.685*kx,.625*ky,.155,(0,.035*ky,.40),seed=73)
    # Thin seams follow each upholstered channel, not a painted-on texture.
    for i in range(1,13):
        t=-.61+(math.pi+1.22)*i/13
        top=.665+.125*max(0,math.sin(t))
        points=[]
        for k in range(16):
            z=.345+(top-.36)*k/15
            points.append(((.342*kx)*math.cos(t),-(.264*ky)*math.sin(t),z))
        curve=bpy.data.curves.new('Upholstery channel seam','CURVE');curve.dimensions='3D'
        curve.bevel_depth=.0009;curve.bevel_resolution=1
        spline=curve.splines.new('POLY');spline.points.add(len(points)-1)
        for p,v in zip(spline.points,points):p.co=(*v,1)
        obj=bpy.data.objects.new('Upholstery channel seam',curve);bpy.context.collection.objects.link(obj)
        obj.data.materials.append(fabric);bpy.context.view_layer.objects.active=obj;obj.select_set(True)
        bpy.ops.object.convert(target='MESH');parts.append(bpy.context.object)
        obj.select_set(False)
    for x in (-1,1):
        for y in (-1,1):tapered_leg('Splayed satin leg',(x*.335*kx,y*.285*ky,.018),(x*.27*kx,y*.22*ky,.31),.012,.02)
    cushion('Loose back pillow',.35*min(1,kx),.37,.13,(-.10*kx,-.14*ky,.585),angle=math.radians(-69),seed=21,loose=True)
    return list(parts)


wood = bpy.data.materials.new('wood')
wood.use_nodes=True
wood.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.72,.72,.72,1)
wood.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.78
grain_spec=importlib.util.spec_from_file_location('wood_grain',Path(__file__).with_name('wood-grain.py'))
grain_module=importlib.util.module_from_spec(grain_spec)
grain_spec.loader.exec_module(grain_module)
wood_image=texture('Original fine timber grain',grain_module.wood_pixels(N))
wood_texture=wood.node_tree.nodes.new('ShaderNodeTexImage');wood_texture.image=wood_image
wood.node_tree.links.new(wood_texture.outputs['Color'],wood.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
wood['houseitTexture']='tint'


def wooden_chair():
    parts.clear()
    # Rear posts meet the seat before leaning back into the crown rail.
    for side in (-1,1):
        for front in (-1,1):
            beam('Wooden leg', (side*.20,front*.205,.012),
                 (side*.165,front*.165,.46), .038,.038,.006,wood)
        beam('Rear back post', (side*.165,-.165,.44),
             (side*.165,-.218,.895), .038,.038,.006,wood)
        beam('Side seat rail', (side*.170,-.180,.393),
             (side*.170,.180,.393), .032,.075,.006,wood)
        beam('Side stretcher', (side*.185,-.194,.20),
             (side*.185,.194,.20), .024,.026,.004,wood)
    for yy in (-.171,.171):block('Front and rear seat rail',(.37,.032,.075),(0,yy,.393),.005,wood)
    block('Gently rounded solid seat',(.43,.435,.048),(0,.016,.454),.014,wood)
    for xx in (-.091,0,.091):
        beam('Back spindle', (xx,-.17,.455), (xx,-.203,.875),
             .025,.025,.006,wood)
    # A curved top rail, rather than a rectangular crossbar.
    vertices,faces=[],[]
    steps=24
    for i in range(steps+1):
        xx=-.189+.378*i/steps
        crown=.026*(1-(xx/.189)**2)
        for yy,zz in [(-.023,0),(.023,0),(.023,.095),(-.023,.095)]:
            vertices.append((xx,-.204+yy-.012*(xx/.189)**2,.82+crown+zz))
    for i in range(steps):
        for j in range(4):faces.append((4*i+j,4*i+(j+1)%4,4*(i+1)+(j+1)%4,4*(i+1)+j))
    faces += [(3,2,1,0),tuple(steps*4+j for j in range(4))]
    obj=mesh('Arched wooden top rail',vertices,faces,wood)
    bpy.context.view_layer.objects.active=obj
    bevel=obj.modifiers.new('Soft timber edges','BEVEL');bevel.width=.005;bevel.segments=3
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    for obj in parts:
        if obj.data.uv_layers.active:
            for uv in obj.data.uv_layers.active.data:uv.uv*=.032
    return list(parts)


def office_chair():
    parts.clear()
    cushion('Shaped office seat',.48,.46,.13,(0,.025,.45),seed=88)
    cushion('Padded ergonomic back',.445,.53,.14,(0,-.19,.785),angle=math.radians(-83),seed=84,back=True)
    block('Under-seat mounting plate',(.42,.37,.04),(0,.015,.395),.012,feet)
    beam('Back support lower bracket',(0,-.10,.395),(0,-.29,.47),.065,.055,.014)
    beam('Back support spine',(0,-.29,.45),(0,-.27,.85),.065,.06,.018)
    beam('Backrest attachment',(0,-.27,.80),(0,-.20,.80),.07,.06,.014)
    tapered_leg('Gas lift',(0,0,.13),(0,0,.415),.031,.025)
    for i in range(5):
        a=math.tau*i/5
        radial=Vector((math.cos(a),math.sin(a),0))
        axle=Vector((-math.sin(a),math.cos(a),0))
        hub=radial*.285+Vector((0,0,.105))
        tapered_leg('Five-star base spoke',(0,0,.16),hub,.022,.028)
        # Each twin caster has a vertical swivel, a trailing fork and a transverse axle.
        swivel=radial*.285
        wheel_centre=radial*.305+Vector((0,0,.033))
        tapered_leg('Caster swivel',swivel+Vector((0,0,.065)),hub,.012,.012)
        for side in (-1,1):
            fork_top=swivel+axle*(side*.013)+Vector((0,0,.078))
            fork_bottom=wheel_centre+axle*(side*.013)
            beam('Caster fork',fork_top,fork_bottom,.012,.014,.004)
        tapered_leg('Caster axle',wheel_centre-axle*.032,wheel_centre+axle*.032,.009,.009)
        for offset in (-.023,.023):
            bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.033,depth=.020,
                location=wheel_centre+axle*offset)
            wheel=bpy.context.object
            wheel.rotation_euler=axle.to_track_quat('Z','Y').to_euler()
            wheel.name='Caster wheel'
            wheel.data.materials.append(feet)
            bevel=wheel.modifiers.new('Rounded tyre edge','BEVEL');bevel.width=.003;bevel.segments=3
            bpy.ops.object.modifier_apply(modifier=bevel.name)
            for poly in wheel.data.polygons:poly.use_smooth=True
            parts.append(wheel)
    for side in (-1,1):
        beam('Arm mounting bracket',(side*.18,.025,.395),(side*.31,.025,.44),.035,.055,.010)
        beam('Arm support',(side*.31,.025,.43),(side*.31,.025,.638),.025,.04,.010)
        block('Soft arm pad',(.070,.285,.052),(side*.31,.025,.637),.021)
    return list(parts)


def opens(obj):
    bm=bmesh.new();bm.from_mesh(obj.data)
    try:return any(not e.is_manifold for e in bm.edges)
    finally:bm.free()


def see_through(mat):
    if mat.blend_method=='BLEND' or mat.get('houseitGlass'):return True
    node=mat.node_tree.nodes.get('Principled BSDF') if mat.use_nodes else None
    return bool(node) and (node.inputs['Alpha'].default_value<1 or node.inputs['Transmission Weight'].default_value>0)


def write_glb(objects,file,extras):
    objects=[o for o in objects if o.name in bpy.data.objects and o.type=='MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.make_single_user(object=True,obdata=True)
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    root=bpy.data.objects.new('Houseit '+file,None);bpy.context.collection.objects.link(root)
    for key,value in extras.items():root[key]=value
    components={};double=set()
    for obj in objects:
        layers=obj.data.uv_layers
        keep=layers.active.name if layers.active else None
        for layer in [l for l in layers if l.name!=keep]:layers.remove(layer)
        if keep:layers[keep].name='UVMap'
        mats=[m for m in obj.data.materials if m]
        if opens(obj) and not obj.data.has_custom_normals:
            bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bm.to_mesh(obj.data);bm.free()
        if opens(obj):double.update(mats)
        double.update(m for m in mats if see_through(m))
        key=obj.get('component') or 'Assembly'
        if key not in components:
            group=bpy.data.objects.new(key,None);bpy.context.collection.objects.link(group);group.parent=root;group['component']=key
            components[key]=group
        obj.parent=components[key]
    for mat in {m for o in objects for m in o.data.materials if m}:mat.use_backface_culling=mat not in double
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [root,*components.values(),*objects]:obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUTPUT/(file+'.glb')),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_materials='EXPORT')
    print(file,'parts',len(objects),'components',len(components),'double-sided',sorted(m.name for m in double),'bytes',(OUTPUT/(file+'.glb')).stat().st_size,flush=True)


def main():
    variants=[('dining-chair-classic',.44,.46,0,False),
              ('office-chair-classic',.71,.66,-1,False),
              ('sofa-classic-two',1.702,.94,2,False),
              ('sofa-classic-chaise',3.023,1.829,3,True),
              ('armchair-classic',.94,.838,1,False),
              ('armchair-compact',.66,.787,1,False),
              ('sofa-classic-three',2.388,.965,3,False)]
    requested = set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
    for file,w,d,n,chaise in variants:
        if requested and file not in requested:
            continue
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False)
        objects=(wooden_chair() if n==0 else office_chair() if n==-1 else barrel_chair(w,d) if n==1 else seating(w,d,n,chaise))
        fabric.name='upholstery' if n==0 else 'body'
        wood.name='body' if n==0 else 'wood'
        if n!=0: fabric.name='body'
        SOURCE.mkdir(parents=True,exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(file+'.blend')),compress=True)
        write_glb(objects,file,{'author':'Houseit','reference':'Original Houseit geometry; visual reference only, no downloaded meshes or textures'})

    if requested:
        return

    # A studio render of the actual exported geometry.
    # Colour is neutral in the GLB for app recolouring; use anthracite for the preview.
    multiply=nodes.new('ShaderNodeMixRGB')
    multiply.blend_type='MULTIPLY'
    multiply.inputs[0].default_value=1
    multiply.inputs[2].default_value=(.24,.27,.29,1)
    links.new(tex.outputs['Color'],multiply.inputs[1])
    links.new(multiply.outputs[0],bsdf.inputs['Base Color'])
    world=bpy.data.worlds.new('Soft studio')
    bpy.context.scene.world=world
    world.use_nodes=True
    world.node_tree.nodes.get('Background').inputs[0].default_value=(.8,.8,.8,1)
    world.node_tree.nodes.get('Background').inputs[1].default_value=.45
    bpy.ops.mesh.primitive_plane_add(size=200)
    ground=bpy.context.object
    ground.name='Studio ground'
    mat=bpy.data.materials.new('Studio white')
    mat.diffuse_color=(.82,.82,.82,1)
    ground.data.materials.append(mat)
    for loc,power,size in [((-3,4,6),650,5),((4,1,4),400,4),((0,-4,5),500,3)]:
        bpy.ops.object.light_add(type='AREA',location=loc)
        light=bpy.context.object
        light.data.energy=power
        light.data.shape='DISK'
        light.data.size=size
        light.rotation_euler=(Vector((0,0,.3))-light.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=(-3.7,5.6,2.7))
    camera=bpy.context.object
    camera.rotation_euler=(Vector((0,.05,.39))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO'
    camera.data.ortho_scale=3.9
    scene=bpy.context.scene
    scene.camera=camera
    scene.render.engine='CYCLES'
    scene.cycles.samples=32
    scene.cycles.use_denoising=True
    scene.render.resolution_x=1100
    scene.render.resolution_y=900
    scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    scene.render.image_settings.file_format='PNG'
    scene.render.filepath=str(SOURCE/'sofa-preview.png')
    bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    main()
