"""Original framed kitchen islands and round adjustable timber stools."""
import importlib.util
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('kitchen',Path(__file__).with_name('make-kitchen.py'))
k=importlib.util.module_from_spec(spec);spec.loader.exec_module(k)
a,b,d,s=k.a,k.b,k.d,k.s
SOURCE=s.ROOT/'assets/kitchen-islands';SOURCE.mkdir(parents=True,exist_ok=True)
b.SOURCE=d.SOURCE=SOURCE;d.render=b.render
ivory=d.material('Ivory island frame',(.86,.85,.81),.78)
oak=d.material('Pale oak stool and shelves',(.52,.40,.25),.83)
metal=d.material('Matte black stool hardware',(.023,.025,.026),.72,.25)


def stool(x,y,key,wood=s.wood):
    start=len(s.parts)
    for i in range(4):
        angle=math.pi/4+i*math.pi/2;c,sn=math.cos(angle),math.sin(angle)
        d.cylinder('Stool floor glide',.021,.012,(.245*c,.245*sn,.006),a.seal,24)
        s.beam('Splayed timber stool leg',(.245*c,.245*sn,.011),(.103*c,.103*sn,.470),.046,.036,.004,wood)
        bolt=d.cylinder('Recessed leg fixing',.006,.004,(.128*c,.128*sn,.451),metal,20)
        bolt.rotation_euler=Vector((c,sn,0)).to_track_quat('Z','Y').to_euler()
    for z,r in ((.370,.135),(.461,.119)):d.cylinder('Timber spindle support',r,.028,(0,0,z),wood,64)
    d.cylinder('Stool spindle housing',.025,.167,(0,0,.393),metal,40)
    d.cylinder('Adjustable stool spindle',.016,.182,(0,0,.554),metal,40)
    for z in [ .481+i*.007 for i in range(11) ]:a.ring('Subtle spindle thread',0,0,z,.017,.0015,metal)
    a.ring('Continuous footrest ring',0,0,.205,.187,.009,metal)
    d.cylinder('Seat underside mounting plate',.065,.018,(0,0,.624),metal,48)
    d.cylinder('Rounded timber stool seat',.215,.029,(0,0,.646),wood,80)
    k.tag(start,key,(x,y,0))


def island(count=2,sink=False):
    s.parts.clear();w=1.422 if count==2 else 2.794;depth=1.397
    top_d=.995;cy=.201;frame= k.paint if sink else ivory;wood=oak if sink else s.wood
    start=len(s.parts)
    top=d.box('Thick eased island worktop',(w,top_d,.043),(0,cy,.8785),.008,k.worktop if sink else wood)
    frame_w=w-.11;frame_d=.620;fy=.291
    for x in (-(frame_w-.05)/2,(frame_w-.05)/2):
        for y in (fy-(frame_d-.05)/2,fy+(frame_d-.05)/2):
            d.box('Island floor foot',(.047,.047,.012),(x,y,.006),.004,a.seal)
            d.box('Square island corner post',(.050,.050,.865),(x,y,.4395),.005,frame)
        d.box('Recessed island end panel',(.020,frame_d-.08,.682),(x,fy,.48),.003,frame)
    d.box('Recessed island rear panel',(frame_w-.06,.020,.697),(0,fy-frame_d/2+.025,.478),.003,frame)
    for z in ((.159,.827) if sink else (.159,.455,.827)):
        d.box('Island front cross rail',(frame_w-.05,.043,.060),(0,fy+frame_d/2-.025,z),.003,frame)
    if sink:
        d.box('Sink cabinet bottom',(frame_w-.07,frame_d-.03,.025),(0,fy,.14),.003,frame)
        for i in range(2 if count==2 else 4):
            bay=(frame_w-.065)/(2 if count==2 else 4);x=-frame_w/2+.0325+(i+.5)*bay
            d.box('Recessed sink island door',(bay-.004,.022,.638),(x,fy+frame_d/2-.018,.492),.003,frame)
            k.pull(x,fy+frame_d/2-.007,.780,min(.16,bay*.4))
        # Two bowls follow the existing double-sink plan symbol.
        by=cy+.030
        for bx in (-.181,.181):k.cut(top,.338,.418,bx,by);k.bowl(bx,by,.35,.43)
        k.faucet(0,cy-.310)
    else:
        for z in (.185,.481):d.box('Inset timber island shelf',(frame_w-.04,frame_d-.04,.025),(0,fy,z),.004,wood)
        if count==4:d.box('Island central shelf divider',(.024,frame_d-.035,.68),(0,fy,.510),.003,frame)
    k.tag(start,'Island frame')
    for i in range(count):stool(-w/2+(i+.5)*w/count,-depth/2+.215,f'Stool {i}',wood)
    return s.parts

MODELS=[('island-two-detailed',2,False),('island-four-detailed',4,False),('island-two-sink-detailed',2,True),('island-four-sink-detailed',4,True)]
def main():
    requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
    for name,count,sink in MODELS:
        if not requested or name in requested:d.export(name,lambda:island(count,sink),k.paint if sink else s.wood)
if __name__=='__main__':main()
