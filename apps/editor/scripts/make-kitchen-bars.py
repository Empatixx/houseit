"""Original home bar with framed bottle display and optional serving island."""
import importlib.util
import math
import sys
from pathlib import Path
import bpy
from mathutils import Matrix

sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('islands',Path(__file__).with_name('make-kitchen-islands.py'))
i=importlib.util.module_from_spec(spec);spec.loader.exec_module(i)
k,a,b,d,s=i.k,i.a,i.b,i.d,i.s
SOURCE=s.ROOT/'assets/kitchen-bars';SOURCE.mkdir(parents=True,exist_ok=True)
b.SOURCE=d.SOURCE=SOURCE;d.render=b.render
bottle_mats=[d.material('Muted olive glass',(.10,.17,.11),.38,.05),d.material('Smoked amber glass',(.26,.14,.065),.42,.05),d.material('Smoked clear glass',(.38,.43,.43),.42,.10)]
label=d.material('Plain bottle label',(.73,.71,.66),.94)
cap=d.material('Bottle closure',(.10,.11,.11),.73)


def bottle(x,y,z,n):
    r=.026+(n%3)*.003;h=.20+(n%4)*.014;verts=[];faces=[];count=40
    profile=[(r*.77,0),(r,.004),(r,h*.65),(r*.92,h*.70),(r*.43,h*.82),(r*.41,h-.012),(r*.46,h-.011),(r*.46,h)]
    for radius,zz in profile:
        for j in range(count):
            angle=math.tau*j/count;verts.append((x+radius*math.cos(angle),y+radius*math.sin(angle),z+zz))
    faces.append(tuple(reversed(range(count))))
    for row in range(len(profile)-1):
        for j in range(count):faces.append((row*count+j,row*count+(j+1)%count,(row+1)*count+(j+1)%count,(row+1)*count+j))
    faces.append(tuple(range((len(profile)-1)*count,len(profile)*count)))
    s.mesh('Unbranded rounded glass bottle',verts,faces,bottle_mats[n%3])
    d.cylinder('Plain bottle paper band',r+.0005,.053,(x,y,z+h*.43),label,40)
    d.cylinder('Bottle closure',r*.46+.0005,.015,(x,y,z+h-.003),cap,32)


def back_bar():
    start=len(s.parts);w,depth=2.057,.635;bay=w/3
    for j in range(3):
        begin=len(s.parts);k.cabinet(bay,depth,drawers=j==2,top=False)
        for obj in s.parts[begin:]:
            for slot in obj.material_slots:
                if slot.material==k.paint:
                    slot.material=s.wood
                    for uv in obj.data.uv_layers.active.data:uv.uv=(uv.uv.y*.032,uv.uv.x*.032)
            obj.location.x+=-w/2+(j+.5)*bay
    top=d.box('Continuous bar counter',(w,depth,.038),(0,0,.881),.006,k.worktop)
    bx=-w/2+bay/2;by=.157
    k.cut(top,.318,.268,bx,by)
    for obj in list(s.parts[start:]):
        if obj.name.startswith('Carcass top cross rail') and obj.location.x<-.4 and obj.location.y>0:k.cut(obj,.318,.268,bx,by)
    k.bowl(bx,by,.330,.280);k.faucet(bx,-.036)
    # Slim framed display rises directly from the countertop at the rear.
    rear=-depth/2;front=rear+.220;bottom=.900;height=.700
    for x in (-w/2+.014,w/2-.014):d.box('Bar display upright',(.028,.220,height),(x,(rear+front)/2,bottom+height/2),.004,s.wood)
    d.box('Recessed display backing',(w-.056,.018,height-.03),(0,rear+.009,bottom+height/2-.015),.003,s.wood)
    for z in (.913,1.242,1.5875):d.box('Bar bottle display shelf',(w-.025,.204,.025),(0,(rear+front)/2+.008,z),.003,s.wood)
    for x in (-.62,-.206,.206,.62):d.box('Bottle display bay divider',(.019,.193,height-.02),(x,(rear+front)/2+.009,bottom+height/2),.002,s.wood)
    for row,z in enumerate((.9255,1.2545)):
        for n in range(10):bottle(-w/2+.13+n*(w-.26)/9,front-.075,z,n+row)
    # A restrained steel edge prevents bottles sliding off the shelf.
    for z in (.946,1.275):k.tube('Connected bottle shelf guard',[(-w/2+.025,front-.014,z),(w/2-.025,front-.014,z)],.004,k.metal)
    k.tag(start,'Back bar')


def serving_island():
    start=len(s.parts);w,depth=2.057,.66;cy=.479
    for x in (-(w-.08)/2,(w-.08)/2):
        for y in (cy-(depth-.08)/2,cy+(depth-.08)/2):
            d.box('Serving island floor glide',(.054,.054,.012),(x,y,.006),.004,a.seal)
            d.box('Serving island post',(.058,.058,1.025),(x,y,.5215),.005,s.wood)
    d.box('Serving island worktop',(w,depth,.042),(0,cy,1.029),.008,s.wood)
    d.box('Recessed serving island front',(w-.08,.025,.895),(0,cy+depth/2-.052,.55),.004,s.wood)
    for x in (-(w-.08)/2,(w-.08)/2):d.box('Recessed serving island end',(.025,depth-.11,.895),(x,cy,.55),.004,s.wood)
    for z in (.15,.58):d.box('Serving island shelf',(w-.08,depth-.10,.026),(0,cy,z),.004,s.wood)
    k.tag(start,'Serving island')
    for n in range(3):
        before=len(s.parts);i.stool(-.67+n*.67,1.0675,f'Bar stool {n}')
        for obj in s.parts[before:]:
            obj.data.transform(Matrix.Diagonal((1,1,.74/.6605,1)) @ obj.matrix_world)
            obj.matrix_world=Matrix.Identity(4)


def build(with_island=False):
    s.parts.clear();back_bar()
    if with_island:
        for obj in s.parts:obj.location.y-=.965
        serving_island()
    return s.parts


def main():
    requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
    for name,island in [('bar-display-detailed',False),('bar-serving-island-detailed',True)]:
        if not requested or name in requested:d.export(name,lambda:build(island),s.wood)
if __name__=='__main__':main()
