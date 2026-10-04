"""Original rugs, yoga mat and box picture frame."""
import importlib.util
import math
import sys
from pathlib import Path
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('lighting',Path(__file__).with_name('make-lighting.py'))
l=importlib.util.module_from_spec(spec);spec.loader.exec_module(l)
f,k,a,b,d,s=l.f,l.k,l.a,l.b,l.d,l.s
SOURCE=s.ROOT/'assets/decor';SOURCE.mkdir(parents=True,exist_ok=True)
b.SOURCE=d.SOURCE=SOURCE;d.render=b.render
rubber=d.material('Editable soft yoga mat',(1,1,1),.9)
base=d.material('Dense charcoal mat base',(.06,.062,.065),.95)
etch=d.material('Etched alignment line',(.70,.71,.70),.9)
lacquer=d.material('Editable frame lacquer',(1,1,1),.55)
board=d.material('Hardboard backing',(.36,.27,.18),.95)
mount=d.material('Warm white mount board',(.90,.89,.85),.95)
paper=d.material('Matte print paper',(.86,.84,.79),.95)
inks=[d.material('Muted terracotta ink',(.62,.33,.22),.9),d.material('Sage ink',(.42,.50,.40),.9),d.material('Sand ink',(.78,.68,.50),.9),d.material('Ink black',(.05,.05,.055),.9)]
glass=d.material('Picture glass',(.85,.9,.9),.05);glass.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.12


def rug_round():
    s.parts.clear();r=1.219
    l.lathe('Low pile round rug',[(0,0),(r-.004,0),(r,.003),(r,.006),(r-.004,.0085),(0,.0085)],s.fabric)
    l.lathe('Bound round rug edge',[(r-.026,.0080),(r-.002,.0080),(r,.0090),(r-.003,.0100),(r-.023,.0100),(r-.026,.0080)],s.fabric)
    k.tag(0,'Round rug');return f.ground(.010)


def rug_rect():
    s.parts.clear();w,dp=2.438,1.829
    d.box('Low pile rectangular rug',(w,dp,.0085),(0,0,.00425),.003,s.fabric)
    for y in (-1,1):d.box('Bound rug edge',(w-.004,.024,.0022),(0,y*(dp/2-.014),.0089),.0009,s.fabric)
    for x in (-1,1):d.box('Bound rug edge',(.024,dp-.004,.0022),(x*(w/2-.014),0,.0089),.0009,s.fabric)
    k.tag(0,'Rectangular rug');return f.ground(.010)


def yoga_mat():
    s.parts.clear();w,ln=.61,1.727
    d.box('Dense mat base layer',(w,ln,.0035),(0,0,.00175),.0015,base)
    top=d.box('Grippy mat surface',(w-.002,ln-.002,.006),(0,0,.0064),.0025,rubber)
    for uv in top.data.uv_layers.active.data:uv.uv*=.5
    d.box('Etched centre alignment line',(.006,ln*.55,.0006),(0,0,.0096),.0002,etch)
    for x in (-1,1):
        for y in (-1,1):
            tick=d.box('Etched hand and foot guide',(.006,.14,.0006),(x*.105,y*.24,.0096),.0002,etch)
            tick.rotation_euler.z=x*y*math.pi/4
    k.tag(0,'Yoga mat');return f.ground(.010)


def picture_frame():
    s.parts.clear();w,dp,h,m=.330,.051,.600,.032
    for z in (m/2,h-m/2):d.box('Deep frame moulding rail',(w,dp,m),(0,0,z),.004,lacquer)
    for x in (-1,1):d.box('Deep frame moulding stile',(m,dp,h-2*m+.004),(x*(w/2-m/2),0,h/2),.004,lacquer)
    d.box('Hardboard backing',(w-2*m+.006,.004,h-2*m+.006),(0,-.021,h/2),.001,board)
    d.box('Bevelled mount board',(w-2*m+.004,.003,h-2*m+.004),(0,.006,h/2),.0008,mount)
    pw,ph=w-2*m-.07,h-2*m-.13
    d.box('Matte print',(pw,.001,ph),(0,.0079,h/2),.0003,paper)
    blocks=[((-.02,.03),(.10,.20),0),((.03,-.06),(.13,.12),1),((-.04,-.12),(.06,.06),2),((.0,.12),(.16,.006),3)]
    for (x,z),(bw,bh),n in blocks:d.box('Printed colour field',(bw,.0006,bh),(x,.0086,h/2+z),.0002,inks[n])
    d.box('Picture glass',(w-2*m+.006,.002,h-2*m+.006),(0,.0135,h/2),.0005,glass)
    k.tag(0,'Picture frame');return f.ground(h)


def main():
    requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
    for name,build,body in [
        ('rug-round-pile',rug_round,s.fabric),
        ('rug-rect-pile',rug_rect,s.fabric),
        ('yoga-mat-grip',yoga_mat,rubber),
        ('picture-frame-deep',picture_frame,lacquer),
    ]:
        if not requested or name in requested:d.export(name,build,body)


if __name__=='__main__':main()
