"""Original hallway furniture from the three user-approved visual references.

Metres, +Y front, floor Z=0. No downloaded meshes or textures are included.
"""
import importlib.util
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('storage',Path(__file__).with_name('make-bedroom-storage.py'))
b=importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)
d,s=b.d,b.s
SOURCE=s.ROOT/'assets/hallway'
SOURCE.mkdir(parents=True,exist_ok=True)
b.SOURCE=d.SOURCE=SOURCE
metal=d.material('Editable powder coat',(1,1,1),.77,.08)
metal['houseitTexture']='tint'
mirror=d.material('Soft silver mirror',(.55,.67,.70),.24,.40)
rubber=d.material('Dark floor glides',(.028,.030,.032),.94)


def render(name):
    node=metal.node_tree.nodes.get('Principled BSDF')
    old=tuple(node.inputs['Base Color'].default_value)
    node.inputs['Base Color'].default_value=(.045,.049,.054,1)
    b.render(name)
    node.inputs['Base Color'].default_value=old


def tube(name,points,radius=.008,mat=metal,closed=False,smooth=True):
    """A continuous capped tube; Bezier control points are actual joint locations."""
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D'
    curve.resolution_u=10;curve.bevel_depth=radius;curve.bevel_resolution=3
    curve.use_fill_caps=True
    if smooth:
        spline=curve.splines.new('BEZIER');spline.bezier_points.add(len(points)-1)
        for p,co in zip(spline.bezier_points,points):
            p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    else:
        spline=curve.splines.new('POLY');spline.points.add(len(points)-1)
        for p,co in zip(spline.points,points):p.co=(*co,1)
    spline.use_cyclic_u=closed
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
    bpy.context.view_layer.objects.active=obj;bpy.ops.object.convert(target='MESH')
    obj=bpy.context.object;obj.data.materials.append(mat)
    for p in obj.data.polygons:p.use_smooth=True
    s.parts.append(obj)
    return obj


def ring(name,radius,z,thickness=.007,mat=metal):
    return tube(name,[(radius*math.cos(a*math.tau/96),radius*math.sin(a*math.tau/96),z)
                     for a in range(96)],thickness,mat,True,False)


def leg(name,bottom,top):
    verts=[]
    for (x,y,z),w,depth in ((bottom,.034,.037),(top,.052,.053)):
        verts.extend([(x+sx*w/2,y+sy*depth/2,z) for sx,sy in ((-1,-1),(1,-1),(1,1),(-1,1))])
    obj=s.mesh(name,verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],s.wood)
    bpy.context.view_layer.objects.active=obj
    bevel=obj.modifiers.new('Soft timber edges','BEVEL');bevel.width=.003;bevel.segments=3
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    normal=obj.modifiers.new('Weighted timber normals','WEIGHTED_NORMAL');normal.keep_sharp=True
    bpy.ops.object.modifier_apply(modifier=normal.name)
    for uv in obj.data.uv_layers.active.data:uv.uv*=.032


def outer_drawer(side):
    # Only the outside end is semicircular; the centre joints stay straight.
    outline=[(.191,-.0485),(.5035,-.0485)]
    for i in range(33):
        a=-math.pi/2+i*math.pi/32
        outline.append((.5035+.0485*math.cos(a),.0485*math.sin(a)))
    outline.append((.191,.0485))
    count=len(outline)
    verts=[(side*x,y,z+.780) for y in (.202,.223) for x,z in outline]
    faces=[tuple(reversed(range(count))),tuple(range(count,count*2))]
    faces += [(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
    obj=s.mesh('Rounded outer drawer front',verts,faces,s.wood)
    bpy.context.view_layer.objects.active=obj
    bevel=obj.modifiers.new('Soft drawer edge','BEVEL');bevel.width=.0015;bevel.segments=3
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    normal=obj.modifiers.new('Weighted front normals','WEIGHTED_NORMAL');normal.keep_sharp=True
    bpy.ops.object.modifier_apply(modifier=normal.name)
    for uv in obj.data.uv_layers.active.data:uv.uv*=.032


def console():
    s.parts.clear()
    b.panel('Continuous rounded console shell',1.143,.140,.445,(0,-.010,.780),s.wood,
            r=.070,opening=(1.107,.104,.052,0))
    d.box('Cabinet rear',(1.030,.016,.113),(0,-.223,.780),.003,s.wood)
    d.box('Central drawer front',(.374,.021,.097),(0,.2125,.780),.002,s.wood)
    for side in (-1,1):outer_drawer(side)
    for x,width in ((-.3715,.361),(0,.374),(.3715,.361)):
        d.box('Drawer bottom',(width,.423,.012),(x,-.0025,.733),.002,s.wood)
        for edge in (-1,1):
            d.box('Drawer side and runner',(.016,.424,.084),(x+edge*(width/2-.007),-.002,.778),.002,s.wood)
        d.box('Rounded timber drawer pull',(.093,.017,.013),(x,.233,.780),.006,s.wood)
        for edge in (-1,1):
            d.box('Drawer pull stand-off',(.012,.025,.012),(x+edge*.033,.224,.780),.003,s.wood)
    for x in (-1,1):
        for y in (-1,1):leg('Splayed console foot',(x*.491,y*.204,0),(x*.306,y*.150,.735))
    # The wall-mounted mirror is intentionally independent of the table below.
    glass=d.cylinder('Wall mirror glass',.370,.008,(0,-.229,1.425),mirror,128)
    glass.rotation_euler.x=math.pi/2
    tube('Thin round mirror frame',[(.375*math.cos(a*math.tau/128),-.229,1.425+.375*math.sin(a*math.tau/128))
                                  for a in range(128)],.008,d.black,True,False)
    return s.parts


def coat_stand():
    s.parts.clear()
    tube('Central coat stand pole',[(0,0,.330),(0,0,1.572)],.011, smooth=False)
    # Four feet pass through the circular brace at exactly r=.166, z=.150.
    for i in range(4):
        a=i*math.pi/2
        radial=lambda r,z:(r*math.cos(a),r*math.sin(a),z)
        tube('Swept coat stand leg',[radial(.015,.490),radial(.024,.367),radial(.111,.223),
                                    radial(.166,.150),radial(.194,.079),radial(.205,.008)],.008)
        d.cylinder('Coat stand floor glide',.011,.008,radial(.205,.004),rubber,32)
        tube('Leg to pole collar',[radial(0,.385),radial(.026,.385)],.012,smooth=False)
    ring('Circular foot brace',.166,.150,.006)
    for i in range(6):
        a=i*math.tau/6
        radial=lambda r,z:(r*math.cos(a),r*math.sin(a),z)
        top=1.787 if i%2==0 else 1.758
        tube('Swept upper coat hook',[radial(.003,1.395),radial(.014,1.542),radial(.070,1.620),
                                     radial(.183,1.672),radial(.203,1.722),radial(.203,top)],.0075)
        cap=d.cylinder('Rounded upper hook cap',.0077,.007,radial(.203,top),metal,24)
    for level in (.930,1.385):
        for i in range(4):
            a=math.pi/4+i*math.pi/2
            tube('Small bag hook',[(r*math.cos(a),r*math.sin(a),z) for r,z in
                                  ((0,level+.043),(.033,level+.005),(.074,level),(.099,level+.029))],.006)
    return s.parts


def clothing_rack():
    s.parts.clear()
    w,depth,h=1.321,.508,1.700
    x=w/2-.027
    y=depth/2-.014
    arch=.160
    for side in (-1,1):
        xx=side*x
        # An elliptical arch joins the front and rear legs in one continuous tube.
        points=[(xx,-y,.020),(xx,-y,h-arch)]
        points += [(xx,-y*math.cos(i*math.pi/40),h-arch+arch*math.sin(i*math.pi/40)) for i in range(1,41)]
        points.append((xx,y,.020))
        tube('Continuous arched side frame',points,.011,smooth=False)
        for yy in (-y,y):d.cylinder('Rack adjustable floor glide',.014,.026,(xx,yy,.013),rubber,32)
        for z in (.198,.650,1.075):
            tube('Side shelf and frame rail',[(xx,-y,z),(xx,y,z)],.008,smooth=False)
    tube('Full-width hanging bar',[(-w/2+.006,0,h),(w/2-.006,0,h)],.012,smooth=False)
    for xx in (-w/2+.006,w/2-.006):
        cap=d.cylinder('Hanging bar end cap',.013,.009,(xx,0,h),metal,32);cap.rotation_euler.y=math.pi/2
    for yy in (-y,y):
        for z in (.198,.650):
            tube('Full-width shelf support',[(-x,yy,z),(x,yy,z)],.009,smooth=False)
    d.box('Solid bag shelf',(2*x+.008,2*y+.003,.015),(0,0,.657),.004,metal)
    for i in range(9):
        yy=-y+i*2*y/8
        tube('Lower shoe shelf rod',[(-x,yy,.205),(x,yy,.205)],.0045,smooth=False)
    return s.parts


def main():
    d.render=render
    requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
    for name,build,body in [
        ('console-rounded-mirror',console,s.wood),
        ('coat-stand-curved',coat_stand,metal),
        ('clothing-rack-arched',clothing_rack,metal),
    ]:
        if not requested or name in requested:d.export(name,build,body)


if __name__=='__main__':main()
