"""Original office furniture, metres, +Y front, floor Z=0."""
import importlib.util
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('storage',Path(__file__).with_name('make-bedroom-storage.py'))
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
d,s=b.d,b.s
SOURCE=s.ROOT/'assets/office';SOURCE.mkdir(parents=True,exist_ok=True)
b.SOURCE=d.SOURCE=SOURCE;d.render=b.render
white=d.material('Warm white powder coated steel',(.88,.89,.88),.73,.08)
rubber=d.material('Dark adjustable floor pads',(.033,.035,.037),.93)
felt=d.material('Cable tray felt',(.16,.17,.18),.98)
steel=d.material('Satin steel hardware',(.38,.40,.41),.58,.45)
paint=d.material('Editable cabinet finish',(1,1,1),.80)
paint['houseitTexture']='tint'


def horizontal(name,outline,z,thick,mat=s.wood):
    n=len(outline);verts=[(x,y,zz) for zz in (z-thick/2,z+thick/2) for x,y in outline]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    obj=s.mesh(name,verts,faces,mat)
    bpy.context.view_layer.objects.active=obj
    bevel=obj.modifiers.new('Fine eased edge','BEVEL');bevel.width=.0025;bevel.segments=3
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    for face in obj.data.polygons:
        if abs(face.normal.z)>.999:face.use_smooth=False
    normal=obj.modifiers.new('Weighted surface normals','WEIGHTED_NORMAL');normal.keep_sharp=True
    bpy.ops.object.modifier_apply(modifier=normal.name)
    for uv in obj.data.uv_layers.active.data:uv.uv*=.032
    return obj


def rounded_polygon(points,radius=.06):
    result=[]
    # Quadratic rounded corners, including the concave knee recess.
    for i,point in enumerate(points):
        p=Vector(point);a=Vector(points[i-1]);c=Vector(points[(i+1)%len(points)])
        r=min(radius,(a-p).length*.4,(c-p).length*.4)
        start=p+(a-p).normalized()*r;end=p+(c-p).normalized()*r
        for j in range(17):
            t=j/16;v=(1-t)**2*start+2*t*(1-t)*p+t*t*end;result.append(tuple(v))
    return result


def leg(x,y,angle=0,round_leg=False):
    def at(xx,yy,z):return (x+xx*math.cos(angle)-yy*math.sin(angle),y+xx*math.sin(angle)+yy*math.cos(angle),z)
    foot=d.box('Rounded steel T foot',(.082,.560 if round_leg else .645,.043),at(0,0,.0365),.020,white);foot.rotation_euler.z=angle
    for yy in ((-.235,.235) if round_leg else (-.269,.269)):d.cylinder('Desk floor pad',.028,.022,at(0,yy,.011),rubber,32)
    if round_leg:
        d.cylinder('Round desk upright',.031,.623,at(0,0,.3535),white,48)
        d.cylinder('Adjustable leg collar',.033,.046,at(0,0,.126),white,48)
    else:
        d.box('Lower telescoping upright',(.068,.064,.330),at(0,0,.205),.012,white)
        d.box('Upper telescoping upright',(.074,.070,.361),at(0,0,.507),.012,white)
    top=d.box('Desk underside bracket',(.09,.560 if round_leg else .610,.044),at(0,0,.694),.007,white);top.rotation_euler.z=angle
    for yy in (-.22,.22):d.cylinder('Flush bracket screw',.006,.006,at(0,yy,.671),steel,24)


def straight():
    s.parts.clear();w,depth=1.829,.813
    outline=rounded_polygon([(-w/2,-depth/2+.084),(w/2,-depth/2+.084),(w/2,depth/2),(-w/2,depth/2)],.045)
    horizontal('Soft edged oak desk top',outline,.728,.024)
    d.box('Rear cable access strip',(w,.084,.024),(0,-depth/2+.042,.728),.010,white)
    # Inset cable cover with visible joints, connected from below.
    d.box('Cable access lid',(.235,.071,.004),(.535,-depth/2+.042,.738),.007,white)
    for x in (-.735,.735):leg(x,.012)
    d.box('Steel cross rail',(1.520,.064,.059),(0,.012,.679),.008,white)
    d.box('Felt cable tray',(1.420,.16,.008),(0,-.235,.625),.004,felt)
    for x in (-.695,.695):d.box('Tray mounting bracket',(.018,.18,.09),(x,-.17,.666),.004,white)
    for y in (-.308,-.162):d.box('Tray raised side',(1.410,.013,.044),(0,y,.644),.005,felt)
    for x in (-.64,.64):
        d.box('Under desk hook stem',(.015,.020,.066),(x,.235,.687),.004,white)
        d.box('Under desk hook return',(.015,.055,.013),(x,.252,.653),.005,white)
    return s.parts


def corner():
    s.parts.clear();w,depth=1.600,1.100;run=.600
    x0,x1=-w/2,w/2;y0,y1=-depth/2,depth/2
    # BEKANT proportions: a 600 mm deep desk with a short 500 mm return.
    outline=rounded_polygon([(x0,y0),(x1,y0),(x1,y1),(x1-run,y1),(x1-run,y0+run),(x0,y0+run)],.085)
    horizontal('Continuous rounded corner oak top',outline,.726,.028)
    # Two T legs, as in the reference. The return leg sits further forward.
    leg(-.65,-.25,round_leg=True);leg(.53,-.04,round_leg=True)
    rail=d.box('Diagonal underside cross rail',(1.255,.060,.054),(-.06,-.145,.687),.009,white)
    rail.rotation_euler.z=math.atan2(.21,1.18)
    d.box('Short return underside support',(.060,.650,.054),(.53,.10,.687),.009,white)
    d.box('Main cable tray',(1.20,.135,.008),(0,-.380,.633),.004,felt)
    for x,y in ((-.53,-.32),(.45,-.23)):
        d.box('Cable tray hanger',(.018,.29,.077),(x,y,.670),.004,white)
    for y in (-.44,-.32):d.box('Cable tray rim',(1.19,.012,.036),(0,y,.649),.004,felt)
    return s.parts


def pocket(front,at):
    cutter=d.box('Temporary finger recess',(.135,.036,.032),at,.013,paint)
    bpy.context.view_layer.objects.active=front
    mod=front.modifiers.new('Recessed rounded finger grip','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    s.parts.remove(cutter);bpy.data.objects.remove(cutter,do_unlink=True)
    for face in front.data.polygons:
        if max(abs(n) for n in face.normal)>.999:face.use_smooth=False
    normal=front.modifiers.new('Front weighted normals','WEIGHTED_NORMAL');normal.keep_sharp=True
    bpy.ops.object.modifier_apply(modifier=normal.name)


def filing():
    s.parts.clear();w,depth=.457,.533
    d.box('Continuous recessed cabinet plinth',(w-.024,depth-.032,.062),(0,-.008,.031),.003,rubber)
    for z in (.065,.989):d.box('Cabinet base and top',(w,depth,.022),(0,0,z),.004,paint)
    for x in (-(w-.019)/2,(w-.019)/2):d.box('Cabinet side',(.019,depth,.906),(x,0,.527),.003,paint)
    d.box('Cabinet back',(w-.030,.017,.906),(0,-depth/2+.0085,.527),.003,paint)
    for i in range(3):
        z=.228+i*.301
        front=d.box('Flush drawer front',(w-.046,.024,.293),(0,depth/2-.012,z),.004,paint)
        pocket(front,(0,depth/2+.005,z+.120))
        d.box('Drawer floor',(w-.061,depth-.032,.015),(0,.004,z-.139),.002,paint)
        for side in (-1,1):
            d.box('Internal drawer side',(.014,depth-.032,.23),(side*(w-.075)/2,.004,z-.024),.002,paint)
            d.box('Drawer runner',(.020,depth-.046,.033),(side*(w-.047)/2,0,z-.070),.003,steel)
    # Small inset combination lock and three understated number wheels.
    lock=d.box('Combination lock surround',(.049,.031,.003),(.100,.171,1.0),.008,steel)
    for x in (.088,.100,.112):d.box('Combination lock wheel',(.007,.015,.004),(x,.171,1.002),.002,rubber)
    return s.parts


def main():
    requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
    for name,build,body in [('desk-oak-steel',straight,s.wood),('desk-corner-oak',corner,s.wood),('filing-three-drawer',filing,paint)]:
        if not requested or name in requested:d.export(name,build,body)

if __name__=='__main__':main()
