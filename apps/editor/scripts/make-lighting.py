"""Original domestic lamps with hollow shades and connected fittings."""
import importlib.util
import math
import sys
from pathlib import Path
import bpy
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('bathroom',Path(__file__).with_name('make-bathroom.py'))
f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
k,a,b,d,s=f.k,f.a,f.b,f.d,f.s
SOURCE=s.ROOT/'assets/lighting';SOURCE.mkdir(parents=True,exist_ok=True)
b.SOURCE=d.SOURCE=SOURCE;d.render=b.render
cloth=d.material('Editable woven lampshade',(1,1,1),.92);cloth['houseitTexture']='tint'
node=cloth.node_tree.nodes.get('Principled BSDF');tex=cloth.node_tree.nodes.new('ShaderNodeTexImage');tex.image=s.color_image
cloth.node_tree.links.new(tex.outputs['Color'],node.inputs['Base Color'])
metal=d.material('Satin lamp fittings',(.48,.49,.47),.47,.48)
opal=d.material('Opal unlit bulb',(.92,.90,.84),.46)
cord=d.material('Quiet cream flex',(.66,.65,.60),.88)


def lathe(name,rows,mat,pleats=0):
    n=256 if pleats else 96;verts=[];faces=[]
    for r,z in rows:
        for j in range(n):
            t=math.tau*j/n;rr=r+(abs(math.sin(t*pleats/2))*.0022 if pleats else 0)
            verts.append((rr*math.cos(t),rr*math.sin(t),z))
    for row in range(len(rows)-1):
        for j in range(n):faces.append((row*n+j,row*n+(j+1)%n,(row+1)*n+(j+1)%n,(row+1)*n+j))
    return s.mesh(name,verts,faces,mat)


def torus(name,r,z,thick,mat):
    return lathe(name,[(r+thick*math.cos(t),z+thick*math.sin(t)) for t in [math.tau*j/12 for j in range(13)]],mat)


def bulb(z):
    lathe('Opal bulb envelope',[(0,z),(.012,z),(.016,z+.018),(.025,z+.032),(.029,z+.047),(.025,z+.064),(.013,z+.076),(0,z+.080)],opal)
    d.cylinder('Bulb socket',.016,.035,(0,0,z-.013),metal,48)


def shade(radius,topradius,z,height,pleated=False):
    # Thin closed wall around a genuinely open top and bottom.
    n=64 if pleated else 0
    lathe('Hollow woven shade',[(radius-.002,z),(radius,z),(radius+(topradius-radius)*.01,z+height*.01),(topradius+(radius-topradius)*.01,z+height*.99),(topradius,z+height),(topradius-.002,z+height),(topradius-.002+(radius-topradius)*.01,z+height*.99),(radius-.002+(topradius-radius)*.01,z+height*.01),(radius-.002,z)],cloth,n)
    for r,zz in [(radius,z+.005),(topradius,z+height-.005)]:
        lathe('Bound lampshade edge',[(r-.003,zz-.005),(r+.003,zz-.005),(r+.003,zz+.005),(r-.003,zz+.005),(r-.003,zz-.005)],cloth)
    mount=z+.025
    torus('Shade mounting ring',radius-.003,mount,.0025,metal)
    for j in range(3):
        t=math.tau*j/3;k.tube('Shade support spoke',[(0,0,mount),((radius-.002)*math.cos(t),(radius-.002)*math.sin(t),mount)],.0022,metal)
    d.cylinder('Shade centre hub',.018,.012,(0,0,mount),metal,48)
    bulb(mount+.038)


def floor_lamp():
    s.parts.clear()
    for j in range(3):
        t=math.tau*j/3+math.pi/2;c=math.cos(t);ss=math.sin(t)
        verts=[]
        for r,z,w in [(.26,0,.027),(.058,.785,.035)]:
            for xx,yy in [(-w/2,-.013),(w/2,-.013),(w/2,.013),(-w/2,.013)]:verts.append(((r+xx)*c-yy*ss,(r+xx)*ss+yy*c,z))
        leg=s.mesh('Flat ended solid ash tripod leg',verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],d.timber)
        bpy.context.view_layer.objects.active=leg;mod=leg.modifiers.new('Eased timber edges','BEVEL');mod.width=.002;mod.segments=3;bpy.ops.object.modifier_apply(modifier=mod.name)
        normal=leg.modifiers.new('Weighted timber face normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=normal.name)
        for uv in leg.data.uv_layers.active.data:uv.uv=(uv.uv.y*.032,uv.uv.x*.032)
    d.cylinder('Tripod junction disc',.077,.035,(0,0,.781),d.timber)
    d.cylinder('Continuous ash mast',.015,.880,(0,0,.900),d.timber)
    for z in (.459,.489):d.cylinder('Flex storage reel',.036,.018,(0,0,z),d.timber)
    k.tube('Flex along rear mast',[(.018,-.018,1.34),(.019,-.018,.80),(.025,-.018,.49),(.038,-.010,.47),(.018,.025,.47),(-.027,.023,.47),(-.032,-.012,.47),(.018,-.025,.47),(.026,-.035,.12),(.019,-.039,.003),(.08,-.04,.003)],.002,cord)
    shade(.218,.211,1.29,.30)
    k.tag(0,'Floor lamp');return f.ground(1.6)


def table_lamp():
    s.parts.clear()
    lathe('Weighted stepped lamp base',[(0,0),(.099,0),(.106,.003),(.108,.009),(.108,.019),(.104,.023),(.090,.028),(.075,.030),(.062,.035),(.053,.043),(.039,.047),(.029,.059),(.022,.068),(.012,.071),(0,.071)],metal)
    d.cylinder('Continuous slender lamp stem',.0075,.275,(0,0,.203),metal,48)
    lathe('Stem base collar',[(.012,.058),(.012,.080),(.009,.087),(.007,.089),(.007,.06),(.012,.058)],metal)
    shade(.175,.108,.29,.21,True)
    k.tube('Pull chain core',[(.012,0,.345),(.034,0,.336),(.034,0,.215)],.0009,metal)
    for j in range(22):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=.0016,location=(.034,0,.218+j*.0055));o=bpy.context.object;o.name='Connected pull chain bead';o.data.materials.append(metal);s.parts.append(o)
    lathe('Small pull chain terminal',[(0,.208),(.003,.209),(.004,.213),(.003,.218),(0,.220)],metal)
    s.parts[-1].location.x=.034
    k.tube('Short rear power flex',[(0,-.085,.013),(.02,-.115,.003),(.066,-.128,.003)],.002,cord)
    k.tag(0,'Table lamp');return f.ground(.5)


def main():
    requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
    for name,build in [('floor-lamp-tripod',floor_lamp),('table-lamp-pleated',table_lamp)]:
        if not requested or name in requested:d.export(name,build,cloth)
if __name__=='__main__':main()
