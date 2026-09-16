"""Complete original kitchens assembled from the detailed cabinets and appliances."""
import importlib.util
import math
import sys
from pathlib import Path
import bpy
from mathutils import Matrix,Vector

sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('kitchen',Path(__file__).with_name('make-kitchen.py'))
k=importlib.util.module_from_spec(spec);spec.loader.exec_module(k)
a,b,d,s=k.a,k.b,k.d,k.s
SOURCE=s.ROOT/'assets/kitchen-sets';SOURCE.mkdir(parents=True,exist_ok=True)
b.SOURCE=d.SOURCE=SOURCE;d.render=b.render


def appliance(kind,w,depth,x,key):
    saved=list(s.parts);(a.fridge if kind=='fridge' else a.stove)();parts=list(s.parts);s.parts[:]=saved+parts
    bpy.context.view_layer.update()
    points=[o.matrix_world @ Vector(v) for o in parts for v in o.bound_box]
    low=Vector([min(p[i] for p in points) for i in range(3)]);high=Vector([max(p[i] for p in points) for i in range(3)])
    centre=(low+high)/2;size=high-low
    transform=Matrix.Translation(Vector((x,0,0))) @ Matrix.Diagonal(Vector((w/size.x,depth/size.y,(1.8 if kind=='fridge' else .9)/size.z,1))) @ Matrix.Translation(Vector((-centre.x,-centre.y,-low.z)))
    for o in parts:o.matrix_world=transform @ o.matrix_world;o['component']=key


def upper(w,depth,open_front=False):
    h=.70;bottom=1.45;centre=bottom+h/2
    for x in (-(w-.018)/2,(w-.018)/2):d.box('Upper cabinet side',(.018,depth,h),(x,0,centre),.003,k.paint)
    d.box('Upper cabinet rear',(w-.024,.014,h),(0,-depth/2+.007,centre),.002,k.paint)
    for z in (bottom+.010,centre,bottom+h-.010):d.box('Upper cabinet fixed shelf',(w-.025,depth,.020),(0,0,z),.002,k.paint)
    if not open_front:
        count=2 if w>.8 else 1
        for i in range(count):
            x=-w/2+(i+.5)*w/count
            d.box('Upper cabinet door',(w/count-.006,.022,h-.004),(x,depth/2-.008,centre),.003,k.paint)
            k.pull(x,depth/2+.003,bottom+.055,min(.15,w/count*.4))


def row(segments,depth,key,at=(0,0,0),angle=0,uppers=False,double=True,upper_extensions=(0,0)):
    start_all=len(s.parts);w=sum(width for kind,width in segments);cursor=-w/2;groups=[];group=[]
    for i,(kind,width) in enumerate(segments):
        x=cursor+width/2;cursor+=width
        if kind in ('fridge','stove'):
            if group:groups.append(group);group=[]
            appliance(kind,width-.005,depth,x,f'{key} {kind}')
        else:
            start=len(s.parts);k.cabinet(width,depth,drawers=kind=='drawers',basin=kind=='sink',double=double,top=False)
            if kind=='corner':
                for obj in list(s.parts[start:]):
                    if obj.name.startswith(('Separate cabinet door','Hidden door hinge','Rounded cabinet pull','Pull connected standoff')):
                        s.parts.remove(obj);bpy.data.objects.remove(obj,do_unlink=True)
                d.box('Blind corner closure',(width-.006,.022,.753),(0,depth/2-.011,.490),.003,k.paint)
            k.tag(start,f'{key} base {i}',(x,0,0));group.append((kind,width,x))
        if uppers and kind!='fridge':
            before=upper_extensions[0] if i==0 else 0;after=upper_extensions[1] if i==len(segments)-1 else 0
            start=len(s.parts);upper(width+before+after,.325,open_front=i==len(segments)-1)
            k.tag(start,f'{key} upper {i}',(x+(after-before)/2,-depth/2+.1625,0))
            for obj in s.parts[start:]:obj['wallMounted']=True
    if group:groups.append(group)
    for j,group in enumerate(groups):
        gw=sum(width for kind,width,x in group);cx=(group[0][2]-group[0][1]/2+group[-1][2]+group[-1][1]/2)/2
        start=len(s.parts);top=d.box('Continuous fitted kitchen worktop',(gw,depth,.038),(cx,0,.881),.004,k.worktop)
        for kind,width,x in group:
            if kind=='sink':
                bw=min(.35,(width-.10)/(2 if double else 1))
                for off in ([-(bw+.012)/2,(bw+.012)/2] if double else [0]):k.cut(top,bw-.012,.418,x+off,.020)
        k.tag(start,f'{key} worktop {j}')
    transform=Matrix.Translation(Vector(at)) @ Matrix.Rotation(angle,4,'Z')
    for obj in s.parts[start_all:]:obj.matrix_world=transform @ obj.matrix_world


def bases(width):
    n=max(1,round(width/.60));return [('drawers' if i%3==0 else 'base',width/n) for i in range(n)]


def build(kind,w,depth,uppers=False,mini=False):
    s.parts.clear();deep=depth if kind=='i' else depth*(.3125 if mini else .25);fw=.65 if mini else .711;sw=.61 if mini else .762;sinkw=.77 if mini else .94
    if kind=='i':
        segments=[('fridge',fw),('sink',sinkw),('stove',sw)]+bases(w-fw-sinkw-sw)
        row(segments,deep,'Straight',uppers=uppers,double=not mini)
    else:
        end=w*(.3125 if mini else .25)
        if kind=='l':segments=[('fridge',fw),('sink',sinkw)]+bases(w-fw-sinkw-end)+[('corner',end)]
        else:segments=[('corner',end)]+bases((w-2*end-sinkw)/2)+[('sink',sinkw)]+bases((w-2*end-sinkw)/2)+[('corner',end)]
        row(segments,deep,'Back',(0,-(depth-deep)/2,0),uppers=uppers,double=not mini)
        remain=depth-deep
        left=bases((remain-sw)/2)+[('stove',sw)]+bases((remain-sw)/2)
        row(left,end,'Left',(w/2-end/2,deep/2,0),math.pi/2,uppers,not mini,(deep-.325,0))
        if kind=='u':
            right=bases((remain-fw)/2)+[('fridge',fw)]+bases((remain-fw)/2)
            row(right,end,'Right',(-w/2+end/2,deep/2,0),-math.pi/2,uppers,True,(0,deep-.325))
    return s.parts


MODELS=[
 ('kitchen-i-mini-detailed','i',2.845,.762,False,True),
 ('kitchen-i-detailed','i',3.797,.737,False,False),
 ('kitchen-l-mini-detailed','l',2.388,2.032,False,True),
 ('kitchen-l-detailed','l',3.251,2.565,False,False),
 ('kitchen-u-detailed','u',3.226,3.023,False,False),
 ('kitchen-i-mini-wall-detailed','i',2.845,.762,True,True),
 ('kitchen-i-wall-detailed','i',3.797,.737,True,False),
 ('kitchen-l-mini-wall-detailed','l',2.388,2.032,True,True),
 ('kitchen-u-wall-detailed','u',3.226,3.023,True,False),
]

def main():
    requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
    for name,*args in MODELS:
        if not requested or name in requested:d.export(name,lambda:build(*args),k.paint)

if __name__=='__main__':main()
