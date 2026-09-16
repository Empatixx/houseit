"""Original ceramic bathroom fixtures and understated vanity cabinets."""
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
SOURCE=s.ROOT/'assets/bathroom';SOURCE.mkdir(parents=True,exist_ok=True)
b.SOURCE=d.SOURCE=SOURCE;d.render=b.render
ceramic=d.material('Soft ceramic glaze',(.94,.945,.94),.34)
paint=d.material('Editable bathroom finish',(1,1,1),.72);paint['houseitTexture']='tint'
seat=d.material('Warm white soft close seat',(.92,.93,.92),.49)
metal=d.material('Satin bathroom fittings',(.51,.55,.56),.38,.55)
drain_dark=d.material('Drain recess',(.065,.074,.076),.85)


def loft(name,profile,mat,offset=(0,0),caps=True,smooth=True):
    # Rows are (width,depth,z,cornerRadius,xOffset,yOffset).
    n=96;verts=[]
    for w,depth,z,r,x,y in profile:
        verts += [(xx+x+offset[0],yy+y+offset[1],z) for xx,yy in s.rounded_rect(w,depth,min(r,w/2-.0001,depth/2-.0001),n)]
    faces=[]
    if caps is True:faces.append(tuple(reversed(range(n))))
    for row in range(len(profile)-1):
        for j in range(n):faces.append((row*n+j,row*n+(j+1)%n,(row+1)*n+(j+1)%n,(row+1)*n+j))
    if caps:faces.append(tuple(range((len(profile)-1)*n,len(profile)*n)))
    obj=s.mesh(name,verts,faces,mat)
    if smooth:
        bpy.context.view_layer.objects.active=obj
        mod=obj.modifiers.new('Continuous ceramic curves','SUBSURF');mod.levels=1;mod.render_levels=1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def opening(obj,w,depth,x,y,z,r=.04):
    cutter=d.box('Temporary ceramic opening',(w,depth,.16),(x,y,z),r,ceramic)
    bpy.context.view_layer.objects.active=obj
    mod=obj.modifiers.new('Actual open basin','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name);s.parts.remove(cutter);bpy.data.objects.remove(cutter,do_unlink=True)
    for f in obj.data.polygons:
        if max(abs(v) for v in f.normal)>.999:f.use_smooth=False


def ground(height):
    points=[obj.matrix_world @ v.co for obj in s.parts for v in obj.data.vertices]
    floor=min(v.z for v in points);top=max(v.z for v in points)
    transform=Matrix.Diagonal((1,1,height/(top-floor),1)) @ Matrix.Translation((0,0,-floor))
    for obj in s.parts:
        obj.data.transform(transform @ obj.matrix_world);obj.matrix_world=Matrix.Identity(4)
    return s.parts


def drain(x,y,z,r=.024,shell=None):
    if shell:
        hit=shell.ray_cast(Vector((x,y,2)),Vector((0,0,-1)))
        assert hit[0], 'Drain must lie on a real ceramic floor'
        z=hit[1].z+.001
    d.cylinder('Drain dark joint',r+.002,.006,(x,y,z),drain_dark,48)
    d.cylinder('Satin pop up drain cover',r,.005,(x,y,z+.003),metal,48)


def basin(x,y,w=.54,depth=.38):
    rows=[(w,depth,.836,.06,0,0),(w,depth,.850,.06,0,0),(w-.014,depth-.014,.854,.06,0,0),
      (w-.035,depth-.035,.854,.059,0,0),(w-.044,depth-.044,.847,.06,0,0),
      (w-.065,depth-.065,.810,.065,0,0),(w-.15,depth-.12,.738,.074,0,0),
      (w-.20,depth-.16,.725,.075,0,0),(.075,.075,.723,.036,0,0)]
    obj=loft('Continuous ceramic basin',rows,ceramic,(x,y),caps='end')
    bpy.context.view_layer.objects.active=obj;mod=obj.modifiers.new('Ceramic basin thickness','SOLIDIFY');mod.thickness=.006;mod.offset=-1;bpy.ops.object.modifier_apply(modifier=mod.name)
    drain(x,y,.726,shell=obj)
    d.box('Basin overflow recess',(.040,.004,.009),(x,y-depth/2+.026,.829),.004,drain_dark)


def tap(x,y):
    d.cylinder('Tap mounting ring',.024,.012,(x,y,.850),metal,48)
    d.cylinder('Single lever mixer body',.019,.116,(x,y,.910),metal,48)
    d.box('Gently rounded mixer spout',(.034,.15,.021),(x,y+.06,.948),.008,metal)
    d.cylinder('Recessed tap aerator',.012,.005,(x,y+.121,.936),drain_dark,32)
    d.cylinder('Lever pivot',.013,.022,(x,y,.976),metal,32)
    d.box('Flat rounded mixer lever',(.031,.096,.015),(x,y+.031,.991),.007,metal)


def vanity(double=False):
    s.parts.clear();w=1.575 if double else .813;depth=.635
    for x in (-(w-.095)/2,(w-.095)/2):
        for y in (-(depth-.10)/2,(depth-.10)/2):
            d.box('Vanity floor pad',(.035,.035,.012),(x,y,.006),.005,a.seal)
            d.box('Vanity leg',(.036,.036,.182),(x,y,.101),.005,paint)
    for x in (-(w-.019)/2,(w-.019)/2):d.box('Vanity cabinet side',(.019,depth-.028,.650),(x,-.014,.50),.003,paint)
    d.box('Vanity cabinet back',(w-.023,.016,.650),(0,-depth/2+.008,.50),.003,paint)
    d.box('Vanity lower shelf',(w-.021,depth-.025,.022),(0,-.01,.183),.003,paint)
    for y in (-depth/2+.035,depth/2-.033):d.box('Vanity upper cross rail',(w-.024,.036,.024),(0,y,.813),.002,paint)
    doors=4 if double else 2
    for j in range(doors):
        x=-w/2+(j+.5)*w/doors
        d.box('Separate vanity door',(w/doors-.005,.022,.637),(x,depth/2-.019,.4995),.003,paint)
        for z in (.25,.74):d.box('Vanity concealed door hinge',(.025,.038,.042),(x-w/doors/2+.03,depth/2-.029,z),.003,metal)
        # A slim inset edge pull stays within the original footprint.
        d.box('Vanity edge pull',(.12,.022,.016),(x,depth/2-.011,.808),.004,metal)
    top=d.box('Ceramic vanity counter',(w,depth,.029),(0,0,.8355),.007,ceramic)
    for x in ([-.385,.385] if double else [0]):
        opening(top,.512,.352,x,.027,.85,.05);basin(x,.027);tap(x,-.243)
    k.tag(0,'Vanity cabinet');return ground(1.0)


def bathtub(free=False):
    s.parts.clear();w=1.549;depth=.914 if free else .838;h=.580 if free else .550
    if free:
        rows=[(w-.26,depth-.22,0,.32,0,0),(w-.24,depth-.20,.015,.33,0,0),(w-.19,depth-.14,.045,.35,0,0),
          (w-.13,depth-.09,.15,.37,0,0),(w-.04,depth-.035,.42,.40,0,0),(w,depth,h-.014,.42,0,0),
          (w,depth,h-.003,.42,0,0),(w-.012,depth-.012,h,.416,0,0),
          (w-.041,depth-.041,h,.405,0,0),(w-.054,depth-.054,h-.01,.397,0,0),
          (w-.08,depth-.075,h-.085,.385,0,0),(w-.20,depth-.17,.19,.32,0,0),
          (w-.29,depth-.23,.135,.30,0,0),(w-.34,depth-.27,.126,.28,0,0),(.075,.075,.126,.034,0,0)]
    else:
        rows=[(w-.035,depth-.035,0,.025,0,0),(w-.035,depth-.035,.018,.025,0,0),
          (w-.012,depth-.012,.034,.018,0,0),(w-.012,depth-.012,h-.04,.018,0,0),
          (w,depth,h-.029,.018,0,0),(w,depth,h-.008,.018,0,0),(w-.015,depth-.015,h,.022,0,0),
          (w-.16,depth-.13,h,.095,0,0),(w-.18,depth-.15,h-.014,.10,0,0),
          (w-.22,depth-.20,h-.06,.11,0,0),(w-.36,depth-.27,.185,.14,0,0),
          (w-.42,depth-.32,.142,.14,0,0),(w-.47,depth-.36,.134,.14,0,0),(.075,.075,.134,.034,-.43,0)]
    shell=loft('Continuous bathtub shell',rows,ceramic)
    dx=0 if free else -.43;drain(dx,0,.129 if free else .137,.029,shell=shell)
    # A low overflow at the inner rear rim follows the shell, without tall fixtures outside the footprint.
    y=-depth/2+(.033 if free else .085)
    d.box('Inset bath overflow',(.07,.018,.012),(0,y,h-.047),.005,metal)
    if not free:
        x=-w/2+.052
        for y in (-.16,.16):
            d.cylinder('Bath deck valve escutcheon',.026,.010,(x,y,h-.002),metal,48)
            d.cylinder('Rounded bath mixer knob',.020,.026,(x,y,h+.010),metal,40)
        d.cylinder('Bath filler mounting ring',.027,.012,(x,0,h+.002),metal,48)
        d.cylinder('Bath filler upright',.018,.102,(x,0,h+.053),metal,48)
        d.box('Rounded bath filler spout',(.17,.035,.022),(x+.071,0,h+.096),.009,metal)
        d.cylinder('Bath filler aerator',.013,.006,(x+.139,0,h+.083),drain_dark,32)
    k.tag(0,'Bathtub');return ground(.580 if free else .657)


def toilet():
    s.parts.clear();w=.483;cy=.0835
    rows=[(.31,.38,0,.145,0,cy-.032),(.32,.39,.012,.15,0,cy-.032),(.32,.39,.025,.15,0,cy-.032),
      (.31,.38,.10,.145,0,cy-.032),(.34,.43,.25,.165,0,cy-.022),
      (.455,.552,.355,.217,0,cy),(.483,.570,.385,.230,0,cy),(.483,.570,.400,.23,0,cy),
      (.47,.56,.411,.227,0,cy),(.365,.44,.411,.175,0,cy+.012),(.350,.42,.402,.168,0,cy+.012),
      (.32,.38,.354,.152,0,cy+.006),(.22,.27,.222,.103,0,cy-.019),(.125,.14,.188,.059,0,cy-.035),(.06,.07,.185,.025,0,cy-.037)]
    loft('Continuous ceramic toilet pedestal and bowl',rows,ceramic)
    d.box('Toilet rear cistern support',(.32,.225,.32),(0,-.240,.26),.04,ceramic)
    d.box('Rounded ceramic cistern',(.449,.201,.351),(0,-.268,.5795),.038,ceramic)
    d.box('Separate cistern lid',(.455,.201,.024),(0,-.268,.760),.017,ceramic)
    d.cylinder('Dual flush surround',.026,.008,(0,-.268,.774),metal,48)
    for x in (-.010,.010):d.box('Dual flush button',(.018,.031,.005),(x,-.268,.7775),.007,metal)
    # The seat is an actual open ring with a rounded section and discreet hinge mounts.
    ring=[(.470,.548,.416,.224,0,cy),(.476,.554,.423,.227,0,cy),(.474,.552,.433,.226,0,cy),
      (.457,.535,.438,.218,0,cy),(.358,.426,.438,.171,0,cy+.010),(.348,.416,.431,.166,0,cy+.010),
      (.350,.418,.420,.167,0,cy+.010),(.366,.434,.416,.175,0,cy+.010),(.470,.548,.416,.224,0,cy)]
    loft('Rounded open toilet seat',ring,seat,caps=False)
    for x in (-.10,.10):
        d.box('Seat rear contact pad',(.03,.046,.017),(x,-.135,.412),.006,a.seal)
        d.cylinder('Seat hinge mount',.017,.025,(x,-.159,.423),metal,32)
    for x in (-.190,.190):d.box('Seat front contact pad',(.032,.05,.016),(x,.195,.413),.006,a.seal)
    lid=[(.465,.541,.438,.221,0,cy),(.480,.557,.443,.228,0,cy),(.480,.557,.451,.228,0,cy),(.465,.542,.458,.221,0,cy),(.42,.50,.460,.20,0,cy)]
    loft('Closed soft close toilet lid',lid,seat)
    k.tag(0,'Toilet');return ground(.780)


def main():
    requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
    for name,build,body in [('vanity-single-detailed',lambda:vanity(False),paint),('vanity-double-detailed',lambda:vanity(True),paint),('bath-built-in-detailed',lambda:bathtub(False),ceramic),('bath-freestanding-detailed',lambda:bathtub(True),ceramic),('toilet-classic-detailed',toilet,ceramic)]:
        if not requested or name in requested:d.export(name,build,body)
if __name__=='__main__':main()
