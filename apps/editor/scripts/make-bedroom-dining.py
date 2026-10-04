"""Original Houseit furniture. Blender --background --python this-file.py.

References inform proportions and construction only. No third-party meshes,
textures, baked lighting, logos or screen images are copied into these assets.
"""
import importlib.util
import math
import sys
import numpy as np
from pathlib import Path
import bpy
from mathutils import Vector

sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('seating',Path(__file__).with_name('make-seating.py'))
s=importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
SOURCE=s.ROOT/'assets/bedroom-dining'
SOURCE.mkdir(parents=True,exist_ok=True)


def material(name,colour,roughness=.85,metallic=0):
    mat=bpy.data.materials.new(name)
    mat.use_nodes=True
    node=mat.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value=(*colour,1)
    node.inputs['Roughness'].default_value=roughness
    node.inputs['Metallic'].default_value=metallic
    return mat

ivory=material('Ivory cotton',(.79,.77,.72),.96)
porcelain=material('Warm white fronts',(.86,.85,.81),.85)
timber=material('Natural wood legs',(.32,.19,.093),.8)
brass=material('Satin bronze feet',(.23,.17,.105),.7,.25)
screen=material('Dark matte screen',(.009,.013,.019),.65)
plastic=material('TV bezel',(.027,.029,.032),.78)
black=s.feet

# Shared neutral grain, preserved when the app tints the wood.
wood_image=s.wood_image


def recolour(objects,mat):
    for obj in objects:
        obj.data.materials.clear()
        obj.data.materials.append(mat)
    return objects


def box(name,size,at,r=.012,mat=None):
    obj=s.block(name,size,at,r,mat or s.fabric)
    if mat in (s.wood,timber):
        for uv in obj.data.uv_layers.active.data:uv.uv=(uv.uv.y*.032,uv.uv.x*.032)
    return obj


def pillow(name,w,d,h,at,angle=0,seed=1,mat=None):
    before=len(s.parts)
    s.cushion(name,w,d,h,at,angle=angle,seed=seed,loose=True)
    if mat:recolour(s.parts[before:],mat)


def cylinder(name,radius,depth,at,mat,vertices=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=at)
    obj=bpy.context.object;obj.name=name;obj.data.materials.append(mat)
    bevel=obj.modifiers.new('Soft machined edge','BEVEL');bevel.width=min(.007,depth*.2);bevel.segments=3
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    for p in obj.data.polygons:p.use_smooth=True
    normal=obj.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    bpy.ops.object.modifier_apply(modifier=normal.name)
    s.parts.append(obj)
    return obj


def duvet(footboard=False,fold=False,kx=1,ky=1):
    nx,ny=64,48 if not fold else 14
    width=2.10*kx
    half=.885*kx-.015
    y0=(-.48 if not fold else -.56)*ky
    y1=((.86 if footboard else 1.30) if not fold else -.26)*ky
    front_edge=.985*ky
    verts,faces=[],[]
    for j in range(ny+1):
        y=y0+(y1-y0)*j/ny
        for i in range(nx+1):
            x=-width/2+width*i/nx
            drop=max(0,abs(x)-(half-.025))
            xx=math.copysign(min(abs(x),half)+.061*(1-math.exp(-drop/.065)),x)
            front=max(0,y-front_edge)
            yy=min(y,front_edge)+.080*(1-math.exp(-front/.075))
            edge=math.exp(-abs(abs(x)-(half+.005))/.15)
            # Fine corner tension, plus broad, low-amplitude relaxed folds on top.
            z=.659-1.05*drop-.95*front
            z+=.012*math.sin(10*y+2.2*x)*(.2+.8*edge)
            z+=.018*math.sin(26*y+2*x)*edge*min(1,drop/.06)
            z+=.007*math.sin(13*x+4*y)*math.sin(5*y+.5)
            z+=.024*math.exp(-((y+.38)/.12)**2)*(1-.15*math.cos(4*x))
            if fold:z+=.025+.018*math.sin(math.pi*(y-y0)/(y1-y0))
            verts.append((xx,yy,z))
    for j in range(ny):
        for i in range(nx):
            a=j*(nx+1)+i;faces.append((a,a+1,a+nx+2,a+nx+1))
    obj=s.mesh('Turned-back duvet edge' if fold else 'Soft draped duvet',verts,faces,ivory if fold else s.fabric)
    bpy.context.view_layer.objects.active=obj
    solid=obj.modifiers.new('Sewn fabric thickness','SOLIDIFY');solid.thickness=.010;solid.offset=0
    bpy.ops.object.modifier_apply(modifier=solid.name)
    # A narrow hem follows the draped lower edge, with the same real folds.
    if not fold:
        curve=bpy.data.curves.new('Duvet hem','CURVE');curve.dimensions='3D';curve.bevel_depth=.002;curve.bevel_resolution=1
        spline=curve.splines.new('POLY');points=verts[ny*(nx+1):];spline.points.add(len(points)-1)
        for p,v in zip(spline.points,points):p.co=(*v,1)
        seam=bpy.data.objects.new('Duvet hem',curve);bpy.context.collection.objects.link(seam);seam.data.materials.append(s.fabric)
        bpy.ops.object.select_all(action='DESELECT');seam.select_set(True);bpy.context.view_layer.objects.active=seam
        bpy.ops.object.convert(target='MESH');s.parts.append(bpy.context.object)


def bed(channelled=False,width=1.94,length=2.18):
    s.parts.clear()
    kx,ky=width/1.94,length/2.18
    head=1.27 if channelled else 1.12
    for x in (-.77*kx,.77*kx):
        for y in (-.89*ky,.89*ky):s.tapered_leg('Bed foot',(x+math.copysign(.027,x),y+math.copysign(.022,y),.006),(x,y,.225),.020,.034,brass if channelled else timber)
    box('Upholstered platform',(width-.09,2.07*ky,.235),(0,.015*ky,.2925),.04)
    box('Padded headboard',(width,.135,head-.15),(0,-1.035*ky,(head+.15)/2),.04)
    count=max(4,round((12 if channelled else 6)*kx))
    step=(width-.06)/count
    for i in range(count):
        s.cushion('Headboard padded channel',step-.005,head-.28,.065,(-(width-.06)/2+step*(i+.5),-1.035*ky+.082,(head+.20)/2),angle=-math.pi/2,seed=100+i,resolution=40)
    mattress=width-.17
    box('Rounded mattress',(mattress,1.99*ky,.215),(0,.015*ky,.513),.055,ivory)
    if channelled:
        box('Padded footboard',(width,.11,.56),(0,1.08*ky,.47),.037)
        for i in range(count):
            s.cushion('Footboard padded channel',step-.005,.51,.057,(-(width-.06)/2+step*(i+.5),1.08*ky+.059,.47),angle=-math.pi/2,seed=140+i,resolution=40)
    sleeping=min(.73,(mattress-.18)/2);accent=min(.50,sleeping*.69)
    for side in (-1,1):
        x=side*(sleeping/2+.065)
        pillow('Sleeping pillow',sleeping,.48,.19,(x,-1.035*ky+.38,.715),angle=math.radians(-13),seed=15+side,mat=ivory)
        pillow('Loose accent pillow',accent,.36,.14,(x+side*.01,-1.035*ky+.60,.792),angle=math.radians(-54),seed=32+side)
    duvet(channelled,kx=kx,ky=ky)
    duvet(channelled,fold=True,kx=kx,ky=ky)
    return s.parts


def table(round_top=False):
    s.parts.clear()
    if round_top:
        top=cylinder('Round solid-wood top',.61,.035,(0,0,.7325),s.wood,96)
        for uv in top.data.uv_layers.active.data:uv.uv*=1.22
        for x,y in [(-1,-1),(-1,1),(1,-1),(1,1)]:
            s.tapered_leg('Tapered wooden table leg',(x*.38,y*.38,.008),(x*.265,y*.265,.718),.024,.041,s.wood)
        for sign in (-1,1):
            box('Under-table apron',(.54,.028,.08),(0,sign*.265,.683),.007,s.wood)
            box('Under-table apron',(.028,.54,.08),(sign*.265,0,.683),.007,s.wood)
    else:
        box('Rounded solid-wood tabletop',(1.8,.90,.048),(0,0,.736),.018,s.wood)
        for side in (-1,1):
            for end in (-1,1):box('Satin steel upright',(.065,.065,.688),(side*.69,end*.34,.36),.008,black)
            box('Steel sled foot',(.065,.745,.035),(side*.69,0,.0175),.006,black)
            box('Steel top support',(.065,.745,.035),(side*.69,0,.695),.006,black)
        box('Recessed cross-brace',(1.38,.04,.04),(0,0,.685),.005,black)
    return s.parts


def television():
    s.parts.clear()
    box('TV chassis',(1.12,.043,.642),(0,-.014,.425),.018,plastic)
    box('Matte glass display',(1.075,.004,.597),(0,.009,.426),.008,screen)
    box('Lower bezel',(1.075,.010,.014),(0,.014,.116),.004,plastic)
    box('TV pedestal',(.32,.225,.017),(0,-.020,.0085),.009,plastic)
    box('TV support neck',(.10,.048,.12),(0,-.039,.070),.010,plastic)
    # Low-profile rear housing and two restrained cable sockets.
    box('Rear electronics enclosure',(.53,.033,.32),(0,-.05,.34),.019,plastic)
    for x in (-.05,.05):box('Rear cable recess',(.031,.003,.015),(x,-.068,.26),.002,black)
    return s.parts


def tv_stand():
    s.parts.clear()
    w,d=1.80,.42
    for x in (-.72,.72):
        for y in (-.13,.13):s.tapered_leg('Splayed cabinet leg',(x*1.055,y*1.20,.008),(x,y,.23),.018,.030,s.wood)
    for z in (.212,.566):box('Cabinet top and base',(w,d,.028),(0,0,z),.008,s.wood)
    for x in (-.886,.886):box('Cabinet side',(.028,d,.326),(x,0,.389),.006,s.wood)
    box('Cabinet rear',(w-.056,.016,.326),(0,-.20,.389),.004,s.wood)
    for x in (-.52,-.08):box('Shelf divider',(.024,d-.026,.326),(x,.006,.389),.004,s.wood)
    box('Open compartment shelf',(.416,.372,.021),(-.30,.016,.381),.004,s.wood)
    box('Small timber door',(.338,.023,.316),(-.704,.214,.390),.006,s.wood)
    door=box('Sliding warm-white door',(.933,.026,.316),(.402,.216,.390),.006,porcelain)
    # Genuine recessed finger pull in the sliding panel.
    bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.014,depth=.06,location=(.006,.216,.475),rotation=(math.pi/2,0,0))
    cutter=bpy.context.object
    bpy.context.view_layer.objects.active=door
    boolean=door.modifiers.new('Recessed finger pull','BOOLEAN');boolean.object=cutter;boolean.operation='DIFFERENCE'
    bpy.ops.object.modifier_apply(modifier=boolean.name);bpy.data.objects.remove(cutter,do_unlink=True)
    return s.parts


def export(name,build,body_material):
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    objects=list(build())
    for mat in bpy.data.materials:
        if mat.name=='body':mat.name='previous body'
    body_material.name='body'
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(name+'.blend')),compress=True)
    s.write_glb(objects,name,{'author':'Houseit','description':'Original mesh and fabric patterns; external models used as visual references only'})
    node=body_material.node_tree.nodes.get('Principled BSDF')
    if body_material in (s.fabric,s.wood):
        tex=next(n for n in body_material.node_tree.nodes if n.type=='TEX_IMAGE' and n.image==(s.color_image if body_material==s.fabric else wood_image))
        multiply=body_material.node_tree.nodes.new('ShaderNodeMixRGB');multiply.blend_type='MULTIPLY';multiply.inputs[0].default_value=1
        multiply.inputs[2].default_value=(.24,.30,.32,1) if body_material==s.fabric else (.44,.28,.13,1);body_material.node_tree.links.new(tex.outputs['Color'],multiply.inputs[1]);body_material.node_tree.links.new(multiply.outputs[0],node.inputs['Base Color'])
    old_colour=tuple(node.inputs['Base Color'].default_value)
    if body_material==s.wood:node.inputs['Base Color'].default_value=(.44,.28,.13,1)
    render(name)
    node.inputs['Base Color'].default_value=old_colour
    if body_material in (s.fabric,s.wood):
        body_material.node_tree.nodes.remove(multiply);body_material.node_tree.links.new(tex.outputs['Color'],node.inputs['Base Color'])


def render(name):
    world=bpy.data.worlds.new('Studio');world.use_nodes=True;bpy.context.scene.world=world
    world.node_tree.nodes.get('Background').inputs[0].default_value=(.8,.8,.8,1)
    world.node_tree.nodes.get('Background').inputs[1].default_value=.6
    bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.data.materials.append(porcelain)
    for loc,power,size in [((-3,4,6),650,5),((4,1,4),450,4),((0,-4,5),350,3)]:
        bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size
        light.rotation_euler=(Vector((0,0,.3))-light.location).to_track_quat('-Z','Y').to_euler()
    is_bed=name.startswith('bed')
    bpy.ops.object.camera_add(location=(-3.2,4.4,3.2 if is_bed else 2.4));camera=bpy.context.object
    camera.rotation_euler=(Vector((0,0,.43))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=3.25 if is_bed else 2.6
    scene=bpy.context.scene;scene.camera=camera;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.render.resolution_x=1000;scene.render.resolution_y=850;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
    scene.render.image_settings.file_format='PNG';scene.render.filepath=str(SOURCE/(name+'.png'));bpy.ops.render.render(write_still=True)


def main():
    requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
    for name,build,body in [
        ('bed-upholstered',lambda:bed(False),s.fabric),
        ('bed-channelled',lambda:bed(True),s.fabric),
        ('bed-upholstered-full',lambda:bed(False,1.397,1.93),s.fabric),
        ('bed-upholstered-queen',lambda:bed(False,1.549,2.057),s.fabric),
        ('bed-upholstered-king',lambda:bed(False,1.956,2.057),s.fabric),
        ('bed-upholstered-cal-king',lambda:bed(False,1.854,2.159),s.fabric),
        ('table-rectangular',lambda:table(False),s.wood),
        ('table-round',lambda:table(True),s.wood),
        ('television-flat',television,plastic),
        ('tv-stand-wood',tv_stand,s.wood),
    ]:
        if not requested or name in requested:export(name,build,body)


if __name__ == "__main__":
    main()
