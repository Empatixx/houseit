"""Original home gym and games-room equipment."""
import importlib.util
import math
import sys
from pathlib import Path
import bpy
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('lighting',Path(__file__).with_name('make-lighting.py'))
l=importlib.util.module_from_spec(spec);spec.loader.exec_module(l)
f,k,a,b,d,s=l.f,l.k,l.a,l.b,l.d,l.s
SOURCE=s.ROOT/'assets/gym';SOURCE.mkdir(parents=True,exist_ok=True)
b.SOURCE=d.SOURCE=SOURCE;d.render=b.render
paint=d.material('Editable powder coat',(1,1,1),.55,.15)
steel=d.material('Black powder coated steel',(.035,.036,.04),.55,.3)
chrome=d.material('Brushed chrome',(.62,.63,.64),.3,.9)
rubber=d.material('Black rubber',(.022,.022,.024),.9)
belt=d.material('Ribbed running belt',(.03,.032,.034),.95)
screen=d.material('Dark console glass',(.012,.016,.02),.25,.1)
vinyl=d.material('Editable padded vinyl',(1,1,1),.6)
felt=d.material('Billiard cloth',(.07,.30,.17),1)
pocket=d.material('Pocket leather',(.03,.025,.022),.7)
court=d.material('Matte table tennis blue',(.05,.12,.26),.75)
line=d.material('Painted white line',(.90,.90,.88),.7)
net=d.material('Dark table tennis net',(.03,.035,.04),.9)
cork=d.material('Paddle rubber red',(.55,.06,.05),.85)
handle=d.material('Paddle wood handle',(.55,.38,.22),.7)
ball_colours=[(.85,.66,.06),(.07,.16,.55),(.62,.08,.07),(.30,.10,.42),(.85,.36,.07),(.05,.35,.16),(.38,.07,.06),(.02,.02,.02)]
balls=[d.material(f'Billiard ball {i+1}',c,.2) for i,c in enumerate(ball_colours)]
ivory=d.material('Cue ball ivory',(.88,.86,.80),.2)


def rod(name,start,end,r,mat,vertices=24):
    return s.tapered_leg(name,start,end,r,r,mat) if vertices==12 else k.tube(name,[start,end],r,mat)


def cylinder_x(name,r,length,at,mat,vertices=48):
    obj=d.cylinder(name,r,length,at,mat,vertices);obj.rotation_euler.y=math.pi/2;return obj


def cylinder_y(name,r,length,at,mat,vertices=48):
    obj=d.cylinder(name,r,length,at,mat,vertices);obj.rotation_euler.x=math.pi/2;return obj


def treadmill():
    s.parts.clear();w=.889
    d.box('Running deck frame',(.74,1.86,.12),(0,.07,.12),.02,paint)
    d.box('Running belt',(.52,1.62,.012),(0,.10,.186),.004,belt)
    for x in (-1,1):
        d.box('Deck side rail',(.10,1.58,.018),(x*.315,.12,.19),.006,steel)
        for y in (-.80,.95):d.box('Levelling foot',(.07,.07,.06),(x*.33,y,.03),.01,rubber)
    d.box('Motor hood',(.78,.36,.20),(0,-.80,.20),.05,paint)
    cylinder_x('Rear roller end cap',.045,.76,(0,.99,.12),steel,32)
    for x in (-1,1):
        rod('Console upright',(x*.36,-.86,.25),(x*.39,-.90,1.20),.028,paint)
        rod('Side handrail',(x*(w/2-.03),-.92,1.18),(x*(w/2-.03),-.42,1.10),.020,steel)
        rod('Handrail front post',(x*(w/2-.03),-.42,1.105),(x*(w/2-.03),-.42,1.02),.018,steel)
        rod('Handrail post foot',(x*(w/2-.03),-.42,1.03),(x*.39,-.62,.92),.018,steel)
    con=d.box('Console housing',(.82,.26,.14),(0,-.92,1.29),.03,paint);con.rotation_euler.x=math.radians(-20)
    disp=d.box('Console display',(.40,.012,.09),(0,-.82,1.33),.006,screen);disp.rotation_euler.x=math.radians(-70)
    for x in (-.23,.23):
        key=d.box('Console speed key',(.09,.04,.035),(x,-.81,1.30),.004,steel);key.rotation_euler.x=math.radians(-70)
    k.tag(0,'Treadmill');return f.ground(1.4)


def exercise_bike():
    s.parts.clear()
    for y,wide in ((-.60,.58),(.60,.50)):
        rod('Stabiliser foot tube',(-wide/2,y,.045),(wide/2,y,.045),.035,paint)
        for x in (-1,1):d.box('Rubber foot cap',(.05,.08,.03),(x*(wide/2),y,.015),.008,rubber)
    rod('Main frame spine',(0,-.58,.07),(0,.58,.07),.032,paint)
    rod('Front column',(0,-.52,.08),(0,-.40,1.00),.034,paint)
    rod('Seat column',(0,.42,.08),(0,.18,.82),.034,paint)
    rod('Diagonal brace',(0,-.47,.19),(0,.38,.43),.026,paint)
    rod('Flywheel fork',(0,-.20,.36),(0,-.50,.66),.02,paint)
    rod('Flywheel axle',(-.06,-.20,.36),(.06,-.20,.36),.012,steel)
    rod('Seat post',(0,.20,.78),(0,.16,.92),.020,chrome)
    rod('Saddle rail',(0,.06,.93),(0,.30,.93),.012,steel)
    d.box('Saddle nose',(.08,.16,.05),(0,.10,.955),.022,vinyl)
    d.box('Saddle rear',(.18,.13,.06),(0,.25,.96),.03,vinyl)
    cylinder_x('Flywheel',.23,.045,(0,-.20,.36),chrome,64)
    cylinder_x('Flywheel guard',.25,.03,(-.045,-.20,.36),paint,64)
    cylinder_x('Crank hub',.05,.10,(0,.02,.32),steel,32)
    for x,z in ((-1,.16),(1,.48)):
        rod('Crank arm',(x*.055,.02,.32),(x*.065,.02 if x<0 else .02,z),.015,steel)
        d.box('Pedal',(.11,.10,.025),(x*.12,.02,z),.006,rubber)
    rod('Handlebar stem',(0,-.425,.90),(0,-.485,1.18),.022,chrome)
    k.tube('Curved handlebar',[(-.24,-.34,1.13),(-.22,-.46,1.16),(-.12,-.50,1.17),(0,-.48,1.17),(.12,-.50,1.17),(.22,-.46,1.16),(.24,-.34,1.13)],.016,steel)
    for x in (-1,1):k.tube('Handlebar grip',[(x*.24,-.35,1.13),(x*.245,-.27,1.10)],.019,rubber)
    con=d.box('Bike console',(.14,.03,.09),(0,-.512,1.15),.01,screen);con.rotation_euler.x=math.radians(-25)
    k.tag(0,'Exercise bike');return f.ground(1.2)


def dumbbell(x,y,z,r):
    rod('Knurled dumbbell handle',(x,y-.10,z),(x,y+.10,z),.016,chrome)
    for side in (-1,1):
        cylinder_y('Rubber dumbbell head',r,.055,(x,y+side*.115,z),rubber,32)
        cylinder_y('Dumbbell end cap',r*.45,.008,(x,y+side*.146,z),chrome,32)


def weight_rack():
    s.parts.clear();w,dp=1.194,.457
    for x in (-1,1):
        rod('Rack side upright front',(x*(w/2-.03),.12,.04),(x*(w/2-.03),.06,1.47),.03,paint)
        rod('Rack side upright rear',(x*(w/2-.03),-.16,.04),(x*(w/2-.03),-.10,1.47),.03,paint)
        d.box('Rack foot',(.07,dp-.02,.04),(x*(w/2-.035),-.0,.02),.01,paint)
        d.box('Rack top cap',(.07,.22,.04),(x*(w/2-.035),-.02,1.48),.01,paint)
    for z,r in ((.42,.085),(.86,.07),(1.28,.06)):
        for y in (-.12,.10):rod('Dumbbell cradle rail',(-(w/2-.03),y,z-r-.014),(w/2-.03,y,z-r-.014),.018,steel)
        for n in range(5):dumbbell(-.44+n*.22,-.01,z,r)
    k.tag(0,'Dumbbell rack');return f.ground(1.5)


def gym_bench():
    s.parts.clear()
    for y in (-.655,.655):
        rod('Bench foot tube',(-.20,y,.04),(.20,y,.04),.03,steel)
        for x in (-1,1):d.box('Square rubber foot',(.06,.06,.03),(x*.20,y,.015),.006,rubber)
    d.box('Bench spine',(.06,1.24,.06),(0,0,.32),.008,steel)
    for y in (-.64,.64):rod('Bench leg',(0,y,.05),(0,y*.92,.30),.03,steel)
    d.box('Seat pad',(.28,.34,.07),(0,-.51,.40),.025,vinyl)
    d.box('Back pad',(.28,.86,.07),(0,.24,.40),.025,vinyl)
    for y,ln in ((-.51,.32),(.24,.84)):d.box('Pad board',(.26,ln,.03),(0,y,.36),.004,steel)
    k.tag(0,'Weight bench');return f.ground(.45)


def pool_table():
    s.parts.clear();w,ln,top=1.626,2.896,.80;rail=.14
    d.box('Cabinet apron',(w-.06,ln-.06,.24),(0,0,.60),.02,s.wood)
    for x in (-1,1):
        d.box('Long rail',(rail,ln,.06),(x*(w/2-rail/2),0,top-.03),.012,s.wood)
        d.box('Long rail cushion',(.05,ln-2*rail-.04,.04),(x*(w/2-rail-.02),0,top-.035),.012,felt)
        for y in (-1,1):d.box('Turned table leg',(.16,.16,.52),(x*(w/2-.17),y*(ln/2-.22),.26),.02,s.wood)
    for y in (-1,1):
        d.box('End rail',(w-2*rail+.004,rail,.06),(0,y*(ln/2-rail/2),top-.03),.012,s.wood)
        d.box('End rail cushion',(w-2*rail-.12,.05,.04),(0,y*(ln/2-rail-.02),top-.035),.012,felt)
    d.box('Slate bed cloth',(w-2*rail+.02,ln-2*rail+.02,.05),(0,0,top-.065),.004,felt)
    for x in (-1,1):
        for y in (-1,0,1):
            px,py=x*(w/2-rail+.03),y*(ln/2-rail+.03) if y else 0
            if not y:px=x*(w/2-rail+.035)
            d.cylinder('Pocket mouth',.062,.05,(px,py,top-.0245),pocket,48)
    r=.0286;z=top-.041+r;cx,cy=0,-ln/4;n=0
    for row in range(5):
        for i in range(row+1):
            bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=r,location=(cx+(i-row/2)*2*r,cy-row*r*1.74,z))
            o=bpy.context.object;o.name='Racked billiard ball';o.data.materials.append(balls[n%8]);s.parts.append(o);n+=1
            for p in o.data.polygons:p.use_smooth=True
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=r,location=(0,ln/4+.12,z))
    o=bpy.context.object;o.name='Cue ball';o.data.materials.append(ivory);s.parts.append(o)
    for p in o.data.polygons:p.use_smooth=True
    k.tag(0,'Pool table');return f.ground(top)


def paddle(x,y,angle):
    head=d.cylinder('Paddle blade',.075,.012,(x,y,.7655),cork,48);head.scale.y=1.1
    grip=d.box('Paddle handle',(.03,.10,.022),(x+.10*math.sin(angle),y-.10*math.cos(angle),.7705),.008,handle);grip.rotation_euler.z=angle


def ping_pong():
    s.parts.clear();w,ln,top=1.525,2.74,.76
    d.box('Table tennis top',(w,ln,.025),(0,0,top-.0125),.004,court)
    for x in (-1,1):d.box('Side line',(.02,ln,.0008),(x*(w/2-.01),0,top+.0004),.0002,line)
    for y in (-1,1):d.box('End line',(w,.02,.0008),(0,y*(ln/2-.01),top+.0004),.0002,line)
    d.box('Centre line',(.003,ln,.0008),(0,0,top+.0004),.0001,line)
    for y in (-1,1):
        d.box('Undercarriage frame',(w-.20,.05,.06),(0,y*.62,top-.05),.008,paint)
        for x in (-1,1):d.box('Table leg',(.05,.05,top-.023),(x*(w/2-.15),y*(ln/2-.25),(top-.023)/2),.008,paint)
    d.box('Table centre frame',(.05,ln-.30,.06),(0,0,top-.05),.008,paint)
    d.box('Net mesh',(1.80,.004,.13),(0,0,top+.08),.001,net)
    d.box('Net headband',(1.80,.008,.016),(0,0,top+.1525-.008),.002,line)
    for x in (-1,1):
        d.box('Net post',(.016,.016,.17),(x*.9065,0,top+.07),.004,steel)
        d.box('Net clamp',(.05,.05,.04),(x*(w/2+.005),0,top-.005),.006,steel)
    paddle(.42,-.85,-.6);paddle(-.38,.76,-2.6)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=.02,location=(-.24,.62,top+.019))
    o=bpy.context.object;o.name='Table tennis ball';o.data.materials.append(line);s.parts.append(o)
    k.tag(0,'Table tennis table');return f.ground(top+.1525)


def main():
    requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
    for name,build,body in [
        ('treadmill-folding',treadmill,paint),
        ('exercise-bike-studio',exercise_bike,paint),
        ('dumbbell-rack-three-tier',weight_rack,paint),
        ('weight-bench-flat',gym_bench,vinyl),
        ('pool-table-classic',pool_table,s.wood),
        ('table-tennis-indoor',ping_pong,paint),
    ]:
        if not requested or name in requested:d.export(name,build,body)


if __name__=='__main__':main()
