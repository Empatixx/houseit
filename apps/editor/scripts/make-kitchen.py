"""Original modular kitchen construction and real recessed sinks."""
import importlib.util
import math
import sys
from pathlib import Path
import bpy
from mathutils import Matrix,Vector

sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('appliances',Path(__file__).with_name('make-appliances.py'))
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
b,d,s=a.b,a.d,a.s
SOURCE=s.ROOT/'assets/kitchen';SOURCE.mkdir(parents=True,exist_ok=True)
b.SOURCE=d.SOURCE=SOURCE;d.render=b.render
paint=d.material('Editable kitchen fronts',(1,1,1),.78);paint['houseitTexture']='tint'
worktop=d.material('Warm mineral worktop',(.69,.68,.64),.84)
metal=d.material('Soft satin sink steel',(.46,.49,.50),.51,.45)
dark=d.material('Recessed plinth shadow',(.065,.069,.070),.93)


def tag(start,key,at=(0,0,0),angle=0):
    transform=Matrix.Translation(Vector(at)) @ Matrix.Rotation(angle,4,'Z')
    for obj in s.parts[start:]:obj.matrix_world=transform @ obj.matrix_world;obj['component']=key


def tube(name,points,r=.012,mat=metal):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.bevel_depth=r;curve.bevel_resolution=1 if r<.003 else 2 if r<.01 else 3;curve.use_fill_caps=True
    line=curve.splines.new('POLY');line.points.add(len(points)-1)
    for p,v in zip(line.points,points):p.co=(*v,1)
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj;bpy.ops.object.convert(target='MESH')
    obj=bpy.context.object;obj.data.materials.append(mat)
    for p in obj.data.polygons:p.use_smooth=True
    s.parts.append(obj);return obj


def cut(obj,w,depth,x,y):
    tool=d.box('Temporary sink cutout',(w,depth,.10),(x,y,.89),.025,worktop)
    bpy.context.view_layer.objects.active=obj;mod=obj.modifiers.new('Through worktop sink opening','BOOLEAN');mod.operation='DIFFERENCE';mod.object=tool
    bpy.ops.object.modifier_apply(modifier=mod.name);s.parts.remove(tool);bpy.data.objects.remove(tool,do_unlink=True)
    for face in obj.data.polygons:
        if max(abs(n) for n in face.normal)>.999:face.use_smooth=False


def bowl(x,y,w=.34,depth=.43):
    n=80;verts=[]
    # Continuous rim, sloped bowl walls and rounded bottom. The centre stays open above the basin floor.
    for ww,dd,z,r in [(w,depth,.901,.030),(w-.028,depth-.028,.901,.027),(w-.035,depth-.035,.887,.027),
                       (w-.043,depth-.043,.754,.032),(w-.067,depth-.067,.730,.039),(.075,.075,.726,.032)]:
        verts += [(xx+x,yy+y,z) for xx,yy in s.rounded_rect(ww,dd,r,n)]
    faces=[]
    for j in range(5):
        for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    faces.append(tuple(range(5*n,6*n)))
    obj=s.mesh('Rounded stainless bowl and rim',verts,faces,metal)
    bpy.context.view_layer.objects.active=obj;solid=obj.modifiers.new('Formed steel thickness','SOLIDIFY');solid.thickness=.002;solid.offset=-1;bpy.ops.object.modifier_apply(modifier=solid.name)
    d.cylinder('Sink drain rim',.036,.004,(x,y,.727),metal,48)
    d.cylinder('Inset drain strainer',.028,.004,(x,y,.729),a.seal,48)
    for i in range(8):
        angle=i*math.tau/8;d.cylinder('Drain strainer opening',.0024,.003,(x+.017*math.cos(angle),y+.017*math.sin(angle),.731),metal,12)
    d.box('Basin overflow plate',(.046,.004,.017),(x,y-depth/2+.019,.86),.003,metal)


def faucet(x,y):
    d.cylinder('Faucet mounting escutcheon',.028,.015,(x,y,.902),metal,48)
    d.cylinder('Faucet mixer body',.021,.114,(x,y,.961),metal,48)
    points=[(x,y,.990),(x,y,1.171)]
    points += [(x,y+.080-.080*math.cos(i*math.pi/32),1.171+.080*math.sin(i*math.pi/32)) for i in range(1,33)]
    points.append((x,y+.160,1.125));tube('Continuous arched faucet spout',points,.012)
    d.cylinder('Faucet aerator',.013,.020,(x,y+.160,1.129),metal,32)
    handle=d.cylinder('Mixer side cap',.017,.028,(x+.026,y,.972),metal,32);handle.rotation_euler.y=math.pi/2
    tube('Mixer lever',[(x+.039,y,.971),(x+.039,y,1.062)],.005)


def cabinet(w,depth,drawers=False,basin=False,double=False,top=True):
    # Source frame occupies the requested footprint; +Y is the front.
    d.box('Continuous cabinet floor plinth',(w,depth-.060,.120),(0,-.014,.060),.004,dark)
    for x in (-(w-.019)/2,(w-.019)/2):d.box('Kitchen cabinet side',(.019,depth-.025,.775),(x,-.0125,.4875),.003,paint)
    d.box('Kitchen cabinet back',(w-.027,.014,.775),(0,-depth/2+.007,.4875),.002,paint)
    d.box('Kitchen cabinet floor',(w-.025,depth-.027,.022),(0,-.0125,.111),.003,paint)
    for y in (-depth/2+.035,depth/2-.046):d.box('Carcass top cross rail',(w-.026,.051,.021),(0,y,.855),.002,paint)
    if drawers and not basin:
        for row,z,h in [(0,.235,.248),(1,.490,.248),(2,.744,.248)]:
            d.box('Separate kitchen drawer front',(w-.007,.022,h),(0,depth/2-.011,z),.003,paint)
            d.box('Drawer floor',(w-.030,depth-.010,.014),(0,0,z-h/2+.01),.002,paint)
            for x in (-(w-.036)/2,(w-.036)/2):d.box('Drawer side and slide',(.019,depth-.035,h-.021),(x,-.012,z),.002,paint)
            pull(0,depth/2,z+h/2-.025,min(.18,w*.45))
    else:
        count=2 if w>.74 else 1
        for i in range(count):
            x=-w/2+(i+.5)*w/count
            d.box('Separate cabinet door',(w/count-.005,.022,.753),(x,depth/2-.011,.490),.003,paint)
            for z in (.170,.780):d.box('Hidden door hinge',(.022,.036,.046),(x-w/count/2+.028,depth/2-.030,z),.003,metal)
            pull(x,depth/2,.837,min(.17,w/count*.45))
        if not basin:d.box('Internal adjustable shelf',(w-.025,depth-.042,.018),(0,-.02,.475),.002,paint)
    counter=d.box('Eased continuous worktop',(w,depth,.038),(0,0,.881),.004,worktop) if top else None
    if basin:
        bw=min(.35,(w-.10)/(2 if double else 1));by=.020
        centres=[-(bw+.012)/2,(bw+.012)/2] if double else [0]
        for x in centres:
            if counter:cut(counter,bw-.012,.418,x,by)
            bowl(x,by,bw,.43)
        faucet(0,-depth/2+.055)


def pull(x,y,z,w):
    d.box('Rounded cabinet pull',(w,.018,.012),(x,y+.018,z),.005,metal)
    for side in (-1,1):d.box('Pull connected standoff',(.012,.034,.012),(x+side*(w/2-.012),y+.006,z),.003,metal)


def run(w,depth,key,at=(0,0,0),angle=0,basin=False,countertop=True):
    count=max(1,round(w/.62));bay=w/count
    for i in range(count):
        start=len(s.parts);cabinet(bay,depth,drawers=i%3==0,basin=basin and i==count//2,double=False,top=basin and countertop)
        transform=Matrix.Translation(Vector(at)) @ Matrix.Rotation(angle,4,'Z') @ Matrix.Translation(Vector((-w/2+(i+.5)*bay,0,0)))
        for obj in s.parts[start:]:obj.matrix_world=transform @ obj.matrix_world;obj['component']=f'{key} cabinet {i}'

    if countertop and not basin:
        start=len(s.parts);d.box('Continuous run worktop',(w,depth,.038),(0,0,.881),.004,worktop);tag(start,key+' worktop',at,angle)


def straight():
    s.parts.clear();run(1.245,.711,'Straight');return s.parts


def corner():
    s.parts.clear();w,depth=2.515,1.245;deep=.700;return_w=.786
    run(w,deep,'Back run',(0,-(depth-deep)/2,0))
    # +X return matches the original SVG; the cabinet front faces into the knee space.
    run(depth-deep,return_w,'Return',(w/2-return_w/2,deep/2,0),math.pi/2)
    return s.parts


def sink_counter():
    s.parts.clear();w,depth=2.489,.737;sink_width=.88;side=(w-sink_width)/2
    run(side,depth,'Left',(w/2-side/2,0,0),countertop=False);run(side,depth,'Right',(-w/2+side/2,0,0),countertop=False)
    start=len(s.parts);cabinet(sink_width,depth,basin=True,double=True,top=False);tag(start,'Sink cabinet')
    start=len(s.parts);top=d.box('Continuous double sink worktop',(w,depth,.038),(0,0,.881),.004,worktop)
    for x in (-.181,.181):cut(top,.338,.418,x,.020)
    tag(start,'Sink worktop')
    return s.parts


def main():
    requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
    for name,build in [('counter-straight-detailed',straight),('counter-corner-detailed',corner),('counter-double-sink',sink_counter)]:
        if not requested or name in requested:d.export(name,build,paint)

if __name__=='__main__':main()
