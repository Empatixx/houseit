"""Original bedroom furniture based on the five user-approved visual references.

Blender --background --python-exit-code 1 --python this-file.py [-- model-name ...]
Uses original timber/textile textures. +Y is the front, metres, floor at Z=0.
"""
import importlib.util
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('bedroom',Path(__file__).with_name('make-bedroom-dining.py'))
d=importlib.util.module_from_spec(spec)
spec.loader.exec_module(d)
s=d.s
SOURCE=s.ROOT/'assets/bedroom-storage'
SOURCE.mkdir(parents=True,exist_ok=True)
d.SOURCE=SOURCE
paint=d.material('Painted panels',(1,1,1),.82)
paint['houseitTexture']='tint'
beech=d.material('Natural beech',(.52,.36,.19),.8)


def panel(name,w,h,thick,at,mat,r=.04,axis='y',opening=None):
    """Rounded panel or continuous frame; a genuine opening, with closed inner walls."""
    def contour(width,height,radius):
        points=[]
        for cx,cz,start in [(width/2-radius,-height/2+radius,-math.pi/2),
                            (width/2-radius,height/2-radius,0),
                            (-width/2+radius,height/2-radius,math.pi/2),
                            (-width/2+radius,-height/2+radius,math.pi)]:
            for i in range(21):
                angle=start+i*math.pi/40
                points.append((cx+radius*math.cos(angle),cz+radius*math.sin(angle)))
        return points
    outline=contour(w,h,r)
    count=len(outline)
    rings=[outline]
    if opening:
        iw,ih,ir,offset=opening
        rings.append([(x,z+offset) for x,z in contour(iw,ih,ir)])
    verts=[]
    for line in rings:
        for y in (-thick/2,thick/2):
            for x,z in line:
                point=Vector((x,y,z) if axis=='y' else (y,x,z))
                verts.append(point+Vector(at))
    faces=[]
    for ring in range(len(rings)):
        start=ring*2*count
        for i in range(count):
            j=(i+1)%count
            faces.append((start+i,start+j,start+count+j,start+count+i))
    if opening:
        for side in (0,count):
            for i in range(count):
                j=(i+1)%count
                faces.append((side+i,side+j,2*count+side+j,2*count+side+i))
    else:
        faces += [tuple(reversed(range(count))),tuple(range(count,2*count))]
    obj=s.mesh(name,verts,faces,mat)
    bpy.context.view_layer.objects.active=obj
    bevel=obj.modifiers.new('Soft panel edge','BEVEL');bevel.width=.003;bevel.segments=3
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    normal=obj.modifiers.new('Weighted panel normals','WEIGHTED_NORMAL');normal.keep_sharp=True
    bpy.ops.object.modifier_apply(modifier=normal.name)
    for uv in obj.data.uv_layers.active.data:uv.uv*=.032
    return obj


def nightstand():
    s.parts.clear()
    w,depth=.635,.533
    for side in (-1,1):
        panel('Rounded continuous side frame',depth,.55,.032,(side*(w-.032)/2,0,.275),s.wood,
              r=.045,axis='x',opening=(depth-.082,.280,.04,-.070))
    d.box('Timber tabletop',(w-.06,depth-.045,.024),(0,0,.528),.010,s.wood)
    d.box('Drawer bottom',(w-.058,depth-.058,.019),(0,0,.361),.004,s.wood)
    d.box('Drawer back',(w-.06,.020,.145),(0,-.236,.434),.006,s.wood)
    front=d.box('Rounded drawer front',(w-.066,.029,.167),(0,.243,.444),.009,s.wood)
    # Rounded finger pocket stops inside the front, leaving a timber back.
    cutter=d.box('Finger pull cutter',(.084,.032,.033),(0,.260,.490),.010,s.wood)
    bpy.context.view_layer.objects.active=front
    modifier=front.modifiers.new('Recessed drawer pull','BOOLEAN');modifier.operation='DIFFERENCE';modifier.object=cutter
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    s.parts.remove(cutter);bpy.data.objects.remove(cutter,do_unlink=True)
    # Boolean-generated front triangles must remain coplanar in the GLB normals.
    for face in front.data.polygons:
        if max(abs(n) for n in face.normal)>.999:face.use_smooth=False
    normal=front.modifiers.new('Recalculate drawer normals','WEIGHTED_NORMAL');normal.keep_sharp=True
    bpy.ops.object.modifier_apply(modifier=normal.name)
    for y in (-.240,.240):d.box('Shelf support rail',(w-.01,.030,.030),(0,y,.115),.005,s.wood)
    for i in range(7):
        d.box('Lower shelf slat',(.037,.496,.024),(-.244+i*.0813,0,.139),.007,s.wood)
    return s.parts


def dresser():
    s.parts.clear()
    w,depth,h=1.295,.787,.80
    d.box('Recessed plinth',(w-.085,depth-.095,.080),(0,-.014,.040),.005,s.wood)
    for z in (.082,.788):d.box('Cabinet top and base',(w,depth,.024),(0,0,z),.005,s.wood)
    for x in (-(w-.024)/2,(w-.024)/2):
        d.box('Cabinet side',(.024,depth,.694),(x,0,.429),.005,s.wood)
    d.box('Cabinet rear',(w-.048,.018,.694),(0,-depth/2+.009,.429),.004,s.wood)
    # Three actual fronts with sloped, recessed top pulls instead of applied handles.
    for row in range(3):
        z=.205+row*.230
        fw,fh=w-.053,.220
        section=[(-.018,-fh/2),(.014,-fh/2),(.014,fh/2-.022),(-.012,fh/2),(-.018,fh/2)]
        verts=[(x,y+depth/2-.014,zz+z) for x in (-fw/2,fw/2) for y,zz in section]
        faces=[tuple(reversed(range(5))),tuple(range(5,10))]
        faces += [(i,(i+1)%5,(i+1)%5+5,i+5) for i in range(5)]
        obj=s.mesh('Drawer front with inset top pull',verts,faces,s.wood)
        bpy.context.view_layer.objects.active=obj
        bevel=obj.modifiers.new('Soft drawer edges','BEVEL');bevel.width=.003;bevel.segments=3
        bpy.ops.object.modifier_apply(modifier=bevel.name)
        weighted=obj.modifiers.new('Weighted drawer normals','WEIGHTED_NORMAL');weighted.keep_sharp=True
        bpy.ops.object.modifier_apply(modifier=weighted.name)
        for uv in obj.data.uv_layers.active.data:uv.uv*=.032
        d.box('Drawer floor',(fw,depth-.035,.017),(0,-.003,z-fh/2+.011),.002,s.wood)
        for side in (-1,1):
            d.box('Internal drawer side',(.016,depth-.030,fh-.035),(side*(fw-.016)/2,-.006,z-.006),.003,s.wood)
            d.box('Drawer runner',(.017,depth-.060,.028),(side*(w/2-.027),-.013,z-.060),.003,s.wood)
    return s.parts


def handle(name,x,z,width=.13,vertical=False,y=.326):
    # A complete U handle, including both stand-offs buried in the door.
    if vertical:
        d.box(name,(.015,.022,width),(x,y+.020,z),.007,d.black)
        for end in (-1,1):d.box('Handle stand-off',(.015,.040,.014),(x,y+.008,z+end*(width/2-.007)),.004,d.black)
    else:
        d.box(name,(width,.022,.015),(x,y+.020,z),.007,d.black)
        for end in (-1,1):d.box('Handle stand-off',(.014,.040,.015),(x+end*(width/2-.007),y+.008,z),.004,d.black)


def wardrobe():
    s.parts.clear()
    w,depth,h=1.20,.60,2.0
    d.box('Recessed wardrobe plinth',(w-.065,depth-.075,.095),(0,-.015,.0475),.004,paint)
    for z in (.105,1.988):d.box('Wardrobe top and bottom',(w,depth,.024),(0,0,z),.004,paint)
    for x in (-(w-.024)/2,(w-.024)/2):
        d.box('Wardrobe side',(.024,depth,1.859),(x,0,1.0475),.004,paint)
    d.box('Wardrobe rear',(w-.048,.018,1.859),(0,-.291,1.0475),.003,paint)
    d.box('Centre partition',(.023,depth-.02,1.859),(0,0,1.0475),.004,paint)
    d.box('Full-height left door',(.570,.024,1.862),(.291,.306,1.047),.006,paint)
    d.box('Upper right door',(.570,.024,1.152),(-.291,.306,1.402),.006,paint)
    handle('Vertical door pull',-.049,1.15,.145,True,y=.316)
    handle('Vertical door pull',.049,1.15,.145,True,y=.316)
    for i in range(3):
        z=.226+i*.234
        d.box('Right lower drawer',(.570,.024,.226),(-.291,.306,z),.005,paint)
        d.box('Internal drawer floor',(.570,.580,.018),(-.291,.014,z-.095),.003,paint)
        handle('Horizontal drawer pull',-.291,z+.062,.150,y=.316)
    # Fixed internal shelves physically connect the separated fronts to the carcass.
    for z in (.116,.818,1.978):
        d.box('Right compartment shelf',(.57,.60,.020),(-.297,0,z),.003,paint)
    for z in (.116,1.978):
        d.box('Left door rail',(.57,.60,.020),(.297,0,z),.003,paint)
    return s.parts


def single_bed():
    s.parts.clear()
    for x in (-.38,.38):
        for y in (-.75,.75):s.tapered_leg('Recessed bed foot',(x,y,0),(x,y,.19),.020,.028,d.timber)
    d.box('Upholstered divan base',(.945,1.795,.255),(0,.005,.2675),.04)
    d.box('Padded single headboard',(.991,.130,.94),(0,-.90,.58),.037)
    for i in range(6):
        s.cushion('Headboard padded channel',.151,.840,.052,(-.393+i*.157,-.822,.595),angle=-math.pi/2,seed=170+i,resolution=40)
    d.box('Rounded single mattress',(.903,1.765,.215),(0,.015,.4825),.050,d.ivory)
    # The existing sewn textile is narrowed to a single bed, with full-sized pillows.
    for fold in (False,True):
        start=len(s.parts);d.duvet(fold=fold)
        for obj in s.parts[start:]:
            for vertex in obj.data.vertices:
                vertex.co.x*=.535;vertex.co.y*=.91;vertex.co.z-=.045
    d.pillow('Sleeping pillow',.72,.45,.18,(0,-.57,.675),angle=math.radians(-12),seed=66,mat=d.ivory)
    d.pillow('Soft accent cushion',.42,.34,.14,(.09,-.405,.746),angle=math.radians(-48),seed=67)
    return s.parts


def crib():
    s.parts.clear()
    w,depth=.711,1.346
    for x in (-.275,.275):
        for y in (-.55,.55):
            s.tapered_leg('Tapered beech foot',(x*1.07,y*1.025,0),(x,y,.290),.016,.027,beech)
    for y in (-(depth-.045)/2,(depth-.045)/2):
        panel('Softly rounded painted end',w,.785,.045,(0,y,.5075),paint,r=.072)
    d.box('Mattress support',(.666,1.294,.035),(0,0,.273),.009,paint)
    d.box('Rounded crib mattress',(.652,1.274,.095),(0,0,.333),.037,d.ivory)
    for side in (-1,1):
        x=side*.327
        for z in (.245,.866):
            d.box('Solid beech side rail',(.041,1.319,.043),(x,0,z),.014,beech)
        for i in range(17):
            y=-.592+i*.074
            s.tapered_leg('Continuous beech spindle',(x,y,.253),(x,y,.869),.008,.008,beech)
    return s.parts


def render(name):
    # Frame the whole piece, including wardrobe height and the bed's feet.
    corners=[o.matrix_world @ Vector(corner) for o in bpy.context.scene.objects if o.type=='MESH' for corner in o.bound_box]
    low=Vector(tuple(min(v[i] for v in corners) for i in range(3)))
    high=Vector(tuple(max(v[i] for v in corners) for i in range(3)))
    centre=(low+high)/2
    world=bpy.data.worlds.new('Soft bedroom studio');world.use_nodes=True;bpy.context.scene.world=world
    world.node_tree.nodes.get('Background').inputs[0].default_value=(.8,.8,.8,1)
    world.node_tree.nodes.get('Background').inputs[1].default_value=.6
    bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.data.materials.append(d.porcelain)
    for loc,power,size in [((-3,4,6),650,5),((4,1,4),450,4),((0,-4,5),350,3)]:
        bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size
        light.rotation_euler=(centre-light.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=centre+Vector((-3.2,4.4,2.7)))
    camera=bpy.context.object;camera.rotation_euler=(centre-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=max(high-low)*1.63
    scene=bpy.context.scene;scene.camera=camera;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.render.resolution_x=1000;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(SOURCE/(name+'.png'))
    bpy.ops.render.render(write_still=True)


def main():
    d.render=render
    requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
    for name,build,body in [
        ('nightstand-rounded',nightstand,s.wood),
        ('dresser-three-drawer',dresser,s.wood),
        ('wardrobe-classic',wardrobe,paint),
        ('bed-single-upholstered',single_bed,s.fabric),
        ('crib-rounded',crib,paint),
    ]:
        if not requested or name in requested:d.export(name,build,body)


if __name__=='__main__':main()
