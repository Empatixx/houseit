"""Original water heater, indoor air handler and gas barbecue."""
import importlib.util
import math
import sys
from pathlib import Path
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('gym',Path(__file__).with_name('make-gym.py'))
g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
l,f,k,a,b,d,s=g.l,g.f,g.k,g.a,g.b,g.d,g.s
SOURCE=s.ROOT/'assets/utility';SOURCE.mkdir(parents=True,exist_ok=True)
b.SOURCE=d.SOURCE=SOURCE;d.render=b.render
paint=d.material('Editable enamelled steel',(1,1,1),.5,.1)
galvanised=d.material('Galvanised duct steel',(.55,.57,.58),.45,.7)
copper=d.material('Copper pipe',(.62,.34,.18),.35,.85)
brass=d.material('Brass valve',(.60,.46,.20),.35,.8)
pvc=d.material('White PVC drain',(.86,.86,.84),.6)
shadow=d.material('Louvre shadow',(.04,.042,.045),.9)
label=d.material('Rating plate',(.80,.80,.76),.6)
steel,chrome,rubber,screen=g.steel,g.chrome,g.rubber,g.screen
grate=d.material('Cast iron grate',(.05,.05,.05),.8,.4)


def water_heater():
    s.parts.clear();r=.312
    l.lathe('Enamelled tank jacket',[(0,.045),(r-.012,.045),(r,.06),(r,1.40),(r-.01,1.43),(r-.06,1.455),(.06,1.465),(0,1.465)],paint)
    l.lathe('Tank base ring',[(r-.035,0),(r-.004,0),(r-.004,.05),(r-.035,.05),(r-.035,0)],steel)
    d.cylinder('Flue collar',.065,.02,(0,0,1.47),galvanised,48)
    d.cylinder('Flue pipe',.05,.035,(0,0,1.4825),galvanised,48)
    for x,y in ((0,-.20),(-.20,0),(.20,0)):
        d.cylinder('Pipe connection nipple',.022,.03,(x,y,1.47),brass,32)
        d.cylinder('Dielectric union',.03,.012,(x,y,1.491),brass,32)
    t=math.radians(-135);ux,uy=math.cos(t),-math.sin(t)
    g.rod('Relief valve body',(ux*(r-.01),uy*(r-.01),1.30),(ux*(r+.07),uy*(r+.07),1.30),.022,brass)
    d.box('Relief valve lever',(.05,.012,.03),(ux*(r+.05),uy*(r+.05),1.335),.004,brass).rotation_euler.z=t
    k.tube('Relief discharge pipe',[(ux*(r+.07),uy*(r+.07),1.30),(ux*(r+.11),uy*(r+.11),1.30),(ux*(r+.11),uy*(r+.11),1.24),(ux*(r+.11),uy*(r+.11),.16)],.013,copper)
    d.box('Thermostat control',(.14,.05,.12),(0,r+.0,.30),.012,steel)
    d.cylinder('Thermostat dial',.025,.016,(0,r+.03,.31),chrome,32).rotation_euler.x=math.pi/2
    d.box('Burner access cover',(.22,.012,.12),(0,r-.002,.14),.004,steel)
    d.box('Rating plate',(.16,.004,.10),(-.12,r-.06,.95),.002,label).rotation_euler.z=math.radians(22)
    k.tag(0,'Water heater');return f.ground(1.5)


def hvac():
    s.parts.clear();w,dp=.96,.56
    d.box('Air handler cabinet',(w,dp,1.0),(0,0,.5),.012,paint)
    d.box('Supply plenum',(.90,.50,.17),(0,0,1.085),.006,galvanised)
    d.cylinder('Supply duct collar',.14,.03,(0,0,1.185),galvanised,64)
    for z,h in ((.27,.44),(.77,.42)):
        d.box('Access panel seam',(w-.04,.004,.006),(0,dp/2+.001,z+h/2),.001,shadow)
    for i in range(10):d.box('Return air louvre slot',(.62,.006,.012),(0,dp/2+.001,.10+i*.035),.003,shadow)
    for x in (-.30,.30):d.box('Panel pull recess',(.12,.006,.02),(x,dp/2+.001,.97),.004,shadow)
    d.box('Rating plate',(.14,.003,.08),(.33,dp/2+.0015,.62),.002,label)
    d.box('Filter rack',(.03,dp-.06,.06),(-(w/2+.012),0,.12),.004,galvanised)
    for y,r in ((-.10,.011),(.0,.008)):
        k.tube('Refrigerant line',[(w/2-.01,y,.88),(w/2+.02,y,.88),(w/2+.02,y,1.16),(w/2-.04,y,1.16)],r,copper)
    k.tube('Condensate drain',[(-(w/2-.01),.14,.18),(-(w/2+.018),.14,.18),(-(w/2+.018),.14,.02)],.011,pvc)
    k.tag(0,'Air handler');return f.ground(1.2)


def bbq():
    s.parts.clear()
    d.box('Cart cabinet',(.60,.56,.56),(0,-.03,.34),.012,paint)
    for x in (-1,1):
        d.box('Cabinet door',(.285,.012,.44),(x*.147,.255,.35),.006,paint)
        g.rod('Door handle',(x*.03,.264,.48),(x*.03,.264,.30),.008,chrome)
        for y in (-.25,.19):
            g.cylinder_x('Caster wheel',.04,.03,(x*.25,y,.04),rubber,24)
            d.box('Caster fork',(.04,.05,.04),(x*.25,y,.07),.006,steel)
    d.box('Firebox',(.70,.62,.16),(0,-.03,.70),.02,steel)
    verts,faces=[],[];nx,nt=40,24;hx,ry,rz=.35,.31,.17
    for i in range(nx+1):
        x=-hx+2*hx*i/nx;taper=(1-abs(x/hx)**4)**.25
        for j in range(nt+1):
            t=math.pi*j/nt;verts.append((x,-.03+ry*math.cos(t)*max(taper,.25),.78+rz*math.sin(t)*max(taper,.05)))
    for i in range(nx):
        for j in range(nt):p=i*(nt+1)+j;faces.append((p,p+nt+1,p+nt+2,p+1))
        p=i*(nt+1);faces.append((p,p+nt,p+2*nt+1,p+nt+1))
    faces.append(tuple(range(nt+1)));faces.append(tuple(reversed(range(nx*(nt+1),(nx+1)*(nt+1)))))
    s.mesh('Domed grill lid',verts,faces,paint)
    for x in (-.25,.25):g.rod('Lid handle stand-off',(x,.21,.86),(x,.345,.88),.01,chrome)
    g.rod('Lid handle bar',(-.27,.345,.88),(.27,.345,.88),.014,chrome)
    g.cylinder_y('Lid thermometer',.03,.03,(0,.15,.925),chrome,32).rotation_euler.x=math.radians(60)
    panel=d.box('Burner control panel',(.66,.05,.09),(0,.30,.70),.01,steel);panel.rotation_euler.x=math.radians(-20)
    for x in (-.18,0,.18):
        g.cylinder_y('Burner control knob',.028,.035,(x,.345,.70),chrome,32)
    for x in (-1,1):
        d.box('Fold-down side shelf',(.40,.54,.025),(x*.5875,-.03,.80),.008,steel)
        d.box('Shelf hinge bracket',(.07,.50,.05),(x*.37,-.03,.77),.006,steel)
        for y in (-.16,.12):d.box('Shelf slat gap',(.37,.012,.0015),(x*.5875,y,.8132),.0005,grate)
        d.box('Shelf end lip',(.02,.54,.04),(x*.7775,-.03,.81),.006,steel)
    k.tag(0,'Gas barbecue');return f.ground(1.0)


def main():
    requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
    for name,build,body in [
        ('water-heater-tank',water_heater,paint),
        ('air-handler-indoor',hvac,paint),
        ('barbecue-gas-cart',bbq,paint),
    ]:
        if not requested or name in requested:d.export(name,build,body)


if __name__=='__main__':main()
