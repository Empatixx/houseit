"""Original lofted sedan and SUV bodies with cut wheel arches."""
import importlib.util
import math
import sys
from pathlib import Path
import bpy
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('gym',Path(__file__).with_name('make-gym.py'))
g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
l,f,k,a,b,d,s=g.l,g.f,g.k,g.a,g.b,g.d,g.s
SOURCE=s.ROOT/'assets/cars';SOURCE.mkdir(parents=True,exist_ok=True)
b.SOURCE=d.SOURCE=SOURCE;d.render=b.render
lacquer=d.material('Editable car lacquer',(1,1,1),.25,.35)
glazing=d.material('Tinted car glazing',(.03,.045,.055),.08,.2)
trim=d.material('Black plastic trim',(.03,.032,.035),.6)
tyre=d.material('Tyre rubber',(.025,.025,.027),.9)
alloy=d.material('Machined alloy wheel',(.55,.56,.57),.3,.85)
lamp=d.material('Clear headlamp',(.85,.87,.88),.1,.2)
tail=d.material('Red tail lamp',(.45,.03,.03),.25)
steel,chrome=g.steel,g.chrome


def curve(points,y):
    for (y0,z0),(y1,z1) in zip(points,points[1:]):
        if y0<=y<=y1:return z0+(z1-z0)*(y-y0)/(y1-y0) if y1>y0 else z1
    return points[0][1] if y<points[0][0] else points[-1][1]


def loft(name,ys,section,mat,m=48):
    verts,faces=[],[]
    for y in ys:
        for x,z in section(y,m):verts.append((x,y,z))
    for i in range(len(ys)-1):
        for j in range(m):p=i*m+j;faces.append((p,p+m,i*m+m+(j+1)%m,i*m+(j+1)%m))
    faces.append(tuple(reversed(range(m))));faces.append(tuple(range((len(ys)-1)*m,len(ys)*m)))
    return s.mesh(name,verts,faces,mat)


def ring(hw,zb,zt,m,n=4,top=1.0):
    out=[]
    for j in range(m):
        t=math.tau*j/m;c,sn=math.cos(t),math.sin(t)
        z=(zb+zt)/2+(zt-zb)/2*math.copysign(abs(sn)**(2/n),sn)
        frac=(z-zb)/max(zt-zb,1e-6);w=hw*((1-frac)+top*frac)
        out.append((w*math.copysign(abs(c)**(2/n),c),z))
    return out


def car(suv):
    s.parts.clear()
    L,W,H=(4.699,1.89,1.70) if suv else (4.877,1.84,1.45)
    clearance,r,base=(.22,.37,2.80) if suv else (.15,.33,2.85)
    half=L/2;yA,yB=(1.05,-half+.22) if suv else (.95,-1.25)
    roof=(-half+.42,.20) if suv else (-.55,.05)
    rail=.035 if suv else 0;top=H-rail
    belt=[(-half,.92),(-half+.18,1.06),(-1.0,1.08),(yA,1.04),(half-.35,.98),(half,.80)] if suv else [(-half,.76),(-half+.28,.92),(-1.2,.94),(yA,.88),(half-.32,.82),(half,.66)]
    plan=lambda y:W/2*max(.06,(1-abs(y/half)**4.5))**(1/4.5)
    under=lambda y:clearance+.14*max(0,abs(y/half)-.72)/.28
    def side(y,z):
        zb,zt=under(y),curve(belt,y);frac=(z-zb)/(zt-zb);w=plan(y)*((1-frac)+.94*frac)
        return w*max(0,1-abs((z-(zb+zt)/2)/((zt-zb)/2))**4)**.25
    ys=[-half+L*i/80 for i in range(81)]
    ys[0]+=.002;ys[-1]-=.002
    body=loft('Lofted lower body',ys,lambda y,m:ring(plan(y),under(y),curve(belt,y),m,4,.94),lacquer)
    for wy in (-base/2,base/2):
        wy+=.10 if suv else .05
        for x in (-1,1):
            cutter=g.cylinder_x('Temporary wheel arch cutter',r+.045,.62,(x*(W/2),wy,r),trim,64)
            bpy.context.view_layer.update()
            mod=body.modifiers.new('Wheel arch','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter;mod.solver='EXACT'
            bpy.context.view_layer.objects.active=body;bpy.ops.object.modifier_apply(modifier=mod.name)
            s.parts.remove(cutter);bpy.data.objects.remove(cutter,do_unlink=True)
    cabin=[(yB,0),(roof[0],1),(roof[1],1),(yA,0)]
    span=[-0+yB+(yA-yB)*i/60 for i in range(61)]
    height=lambda y:curve(belt,y)-.04+(top-curve(belt,y)+.04)*curve(cabin,y)
    loft('Glazed cabin',span,lambda y,m:ring(plan(y)*.93,curve(belt,y)-.05,max(height(y),curve(belt,y)+.01),m,6,.74),glazing)
    r0,r1=roof[0]-(.0 if suv else .30),roof[1]+(.0 if suv else .32)
    rs=[r0+(r1-r0)*i/40 for i in range(41)]
    loft('Roof panel',rs,lambda y,m:ring(plan(y)*.93*.765,height(y)-.06,height(y)+.004,m,6,.97),lacquer)
    if suv:
        for x in (-1,1):k.tube('Roof rail',[(x*plan(0)*.62,roof[0]+.05,top-.01),(x*plan(0)*.62,roof[0]+.08,H-.012),(x*plan(0)*.62,roof[1]-.05,H-.012),(x*plan(0)*.62,roof[1]-.02,top-.01)],.012,steel)
    for wy in (-base/2,base/2):
        wy+=.10 if suv else .05
        g.rod('Drive axle',(-(plan(wy)-.13),wy,r),(plan(wy)-.13,wy,r),.03,steel)
        for x in (-1,1):
            cx=x*(plan(wy)-.13)
            g.cylinder_x('Tyre',r,.225,(cx,wy,r),tyre,64)
            g.cylinder_x('Alloy wheel',r*.66,.03,(cx+x*.1,wy,r),alloy,48)
            g.cylinder_x('Wheel hub cap',r*.16,.02,(cx+x*.12,wy,r),steel,24)
    front=curve(belt,half-.12)
    for x in (-1,1):
        d.box('Headlamp',(.34,.10,.09),(x*(plan(half-.12)-.24),half-.10,front-.07),.03,lamp)
        d.box('Tail lamp',(.36,.08,.08),(x*(plan(-half+.1)-.24),-half+.09,curve(belt,-half+.1)-.07),.025,tail)
        my=yA-.18;mz=curve(belt,my)+.06
        az=curve(belt,my)-.012;inner=side(my,az)-.03
        d.box('Mirror arm',(W/2+.01-inner,.05,.04),(x*(inner+W/2+.01)/2,my,az),.01,trim)
        d.box('Door mirror',(.12,.10,.12),(x*(W/2+.0435+.0),my,mz),.03,lacquer)
        for hy in ((-.35,.55) if suv else (-.40,.50)):
            hz=curve(belt,hy)-.10;d.box('Door handle',(.03,.14,.025),(x*side(hy,hz),hy,hz),.008,chrome)
    d.box('Front grille',(.80 if suv else .70,.05,.16 if suv else .12),(0,half-.005,.55 if suv else .45),.02,trim)
    d.box('Rear bumper diffuser',(1.1,.05,.10),(0,-half+.03,clearance+.14),.02,trim)
    k.tag(0,'SUV' if suv else 'Sedan');return f.ground(H)


def main():
    requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
    for name,build,body in [('car-sedan',lambda:car(False),lacquer),('car-suv',lambda:car(True),lacquer)]:
        if not requested or name in requested:d.export(name,build,body)


if __name__=='__main__':main()
