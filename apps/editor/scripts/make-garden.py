"""Original garden planting: trees, shrubs, hedge, grasses, flower bed, water lilies and koi."""
import importlib.util
import math
import random
import sys
from pathlib import Path
import bpy
from mathutils import Vector, noise
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('lighting',Path(__file__).with_name('make-lighting.py'))
l=importlib.util.module_from_spec(spec);spec.loader.exec_module(l)
f,k,a,b,d,s=l.f,l.k,l.a,l.b,l.d,l.s
SOURCE=s.ROOT/'assets/garden';SOURCE.mkdir(parents=True,exist_ok=True)
b.SOURCE=d.SOURCE=SOURCE;d.render=b.render
leaves=d.material('Editable foliage',(1,1,1),.78);leaves['houseitTexture']='tint'
deep=d.material('Deep evergreen needles',(.07,.16,.08),.85)
fresh=d.material('Fresh shrub leaves',(.16,.31,.11),.8)
bark=d.material('Grey brown bark',(.24,.19,.14),.95)
birchbark=d.material('Birch white bark',(.82,.80,.74),.85)
lenticel=d.material('Birch bark marks',(.08,.08,.07),.9)
soil=d.material('Dark garden soil',(.07,.05,.03),1)
timber=d.material('Weathered timber edging',(.38,.28,.18),.9)
bloom=d.material('Editable blossom',(1,1,1),.7);bloom['houseitTexture']='tint'
petals=[d.material(n,c,.7) for n,c in [('Coral petals',(.80,.30,.24)),('Butter petals',(.92,.80,.30)),('Violet petals',(.42,.30,.62)),('White petals',(.90,.89,.85))]]
stem=d.material('Green stem',(.18,.33,.12),.8)
pad=d.material('Lily pad',(.17,.36,.14),.55)
koi=d.material('Editable koi scales',(1,1,1),.45);koi['houseitTexture']='tint'
pearl=d.material('Koi white patch',(.92,.90,.86),.45)
fin=d.material('Translucent fin',(.95,.72,.55),.5)
eye=d.material('Fish eye',(.02,.02,.02),.2)


def blob(name,at,radius,squash=1.0,mat=leaves,seed=0,detail=3):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=detail,radius=radius,location=at)
    obj=bpy.context.object;obj.name=name
    shift=Vector((seed*3.1,seed*1.7,seed*2.3))
    for v in obj.data.vertices:
        n=noise.noise(v.co*3.2/radius+shift)
        v.co*=1+.16*n
        v.co.z*=squash
    obj.data.materials.append(mat)
    for p in obj.data.polygons:p.use_smooth=True
    s.parts.append(obj);return obj


def limb(name,points,r0,r1,mat=bark):
    for i in range(len(points)-1):
        t0,t1=i/(len(points)-1),(i+1)/(len(points)-1)
        s.tapered_leg(name,points[i],points[i+1],r0+(r1-r0)*t0,r0+(r1-r0)*t1,mat)
        s.parts[-1].name=name


def crown(rng,count,centre,spread,height,rmin,rmax,mat=leaves,squash=.85,top=None):
    for n in range(count):
        a=rng.random()*math.tau;r=spread*math.sqrt(rng.random())
        z=centre+(rng.random()-.5)*height
        at=(r*math.cos(a),r*math.sin(a),z)
        blob('Leaf cluster',at,rmin+(rmax-rmin)*rng.random(),squash,mat,seed=n)
        root=(0,0,min(z,top if top is not None else z)-.3)
        k.tube('Twig into leaf cluster',[root,at],.018,bark)


def deciduous():
    s.parts.clear();rng=random.Random(11)
    limb('Tapered trunk',[(0,0,-.05),(.02,.01,1.2),(-.03,.02,2.3)],.17,.11)
    for j in range(5):
        t=j*math.tau/5+.4;out=Vector((math.cos(t),math.sin(t),0))
        limb('Main branch',[(-.03,.02,2.1),tuple(Vector((0,0,2.9))+out*.7),tuple(Vector((0,0,3.6))+out*1.3)],.09,.04)
    crown(rng,16,4.1,1.45,1.6,.75,1.05,top=3.6)
    blob('Crown top',(0,0,5.0),.95,.8,seed=40)
    return f.ground(6.0)


def birch():
    s.parts.clear();rng=random.Random(5)
    for side,lean in ((-1,.12),(1,-.08)):
        limb('White birch stem',[(side*.08,0,-.05),(side*.12+lean,.03,2.4),(side*.06+lean*1.6,.05,4.6)],.1,.05,birchbark)
        for z in [.4+i*.45 for i in range(9)]:
            t=min(z/2.4,1.0);x=side*.08+(side*.12+lean-side*.08)*t;y=.03*t
            d.box('Birch bark mark',(.05,.03,.02),(x,y-.085+.004*z,z),.004,lenticel)
    for j in range(6):
        t=j*1.05;out=Vector((math.cos(t),math.sin(t),0))
        limb('Fine birch branch',[(0,.03,3.2+j*.2),tuple(Vector((0,0,4.0+j*.25))+out*.9)],.035,.015,birchbark)
    crown(rng,22,5.1,1.15,2.6,.4,.64,squash=1.15,top=4.4)
    return f.ground(7.0)


def conifer():
    s.parts.clear()
    limb('Spruce trunk',[(0,0,-.05),(0,0,7.2)],.13,.04)
    tiers=11
    for i in range(tiers):
        t=i/(tiers-1);z=.5+t*6.2;radius=1.48*(1-t)**.92+.12
        rows=[]
        for j in range(49):
            ang=j*math.tau/48;spike=1 if j%2==0 else .78
            rows.append((ang,radius*spike))
        verts=[(0,0,z+1.0*(1-t*.4))]
        for ang,r in rows:verts.append((r*math.cos(ang),r*math.sin(ang),z-.05))
        for ang,r in rows:verts.append((r*.55*math.cos(ang+.07),r*.55*math.sin(ang+.07),z+.22))
        faces=[]
        for j in range(48):
            o=1+j;p=1+(j+1)%48;q=50+j;w=50+(j+1)%48
            faces.append((o,p,w,q));faces.append((q,w,0))
        faces.append(tuple(reversed(range(1,49))))
        s.mesh('Needle tier',verts,faces,leaves if i%2 else deep)
    return f.ground(7.5)


def shrub():
    s.parts.clear();rng=random.Random(3)
    for n in range(7):
        a=n*2.4;r=.18+.22*rng.random()
        blob('Shrub leaf mass',(r*math.cos(a),r*math.sin(a),.42+.18*rng.random()),.32+.08*rng.random(),.85,seed=n)
    blob('Shrub crown',(0,0,.62),.38,.8,seed=9)
    return f.ground(1.0)


def flowering():
    s.parts.clear();rng=random.Random(8)
    for n in range(8):
        a=n*2.4;r=.2+.24*rng.random()
        blob('Hydrangea foliage',(r*math.cos(a),r*math.sin(a),.45+.15*rng.random()),.33+.07*rng.random(),.85,fresh,seed=n)
    for n in range(30):
        a=n*2.399963;up=1-(n+.5)/30*.8
        direction=Vector((math.cos(a)*math.sqrt(1-up*up),math.sin(a)*math.sqrt(1-up*up),up))
        at=Vector((0,0,.5))+direction*Vector((.48,.48,.42))
        blob('Hydrangea flower head',tuple(at),.085+.035*rng.random(),.85,bloom,seed=50+n,detail=2)
    return f.ground(1.1)


def hedge():
    s.parts.clear();w,dp,h=2.0,.6,1.4
    bpy.ops.mesh.primitive_cube_add(size=1,location=(0,0,h/2));obj=bpy.context.object;obj.name='Clipped hedge body'
    obj.dimensions=(w-.04,dp-.04,h-.02);bpy.ops.object.transform_apply(scale=True)
    mod=obj.modifiers.new('Soft clipped corners','BEVEL');mod.width=.07;mod.segments=3;bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=obj.modifiers.new('Leafy surface','SUBSURF');mod.levels=2;bpy.ops.object.modifier_apply(modifier=mod.name)
    for v in obj.data.vertices:
        if v.co.z<.02:continue
        n=noise.noise(v.co*7.0);v.co+=v.normal*.025*n
    obj.data.materials.append(leaves)
    for p in obj.data.polygons:p.use_smooth=True
    s.parts.append(obj)
    for x in (-.6,0,.6):limb('Hedge stem',[(x,0,-.02),(x,0,.35)],.03,.02)
    return f.ground(h)


def grass():
    s.parts.clear();rng=random.Random(2)
    d.cylinder('Grass crown',.12,.06,(0,0,.03),soil,24)
    for n in range(80):
        a=rng.random()*math.tau;lean=.25+.45*rng.random();length=.75+.3*rng.random()
        root=Vector((.06*math.cos(a),.06*math.sin(a),.04));side=Vector((-math.sin(a),math.cos(a),0))
        verts=[];faces=[]
        for i in range(7):
            t=i/6;width=.012*(1-t)+.001
            p=root+Vector((math.cos(a),math.sin(a),0))*lean*length*t*t+Vector((0,0,length*math.sin(t*1.25)))
            verts+= [tuple(p-side*width),tuple(p+side*width)]
        for i in range(6):faces.append((2*i,2*i+1,2*i+3,2*i+2))
        for i in range(6):faces.append((2*i+2,2*i+3,2*i+1,2*i))
        s.mesh('Grass blade',verts,faces,leaves)
    return f.ground(1.0)


def flower_bed():
    s.parts.clear();w,dp=2.0,.8;rng=random.Random(4)
    for y in (-1,1):d.box('Timber edging board',(w,.04,.18),(0,y*(dp/2-.02),.09),.006,timber)
    for x in (-1,1):d.box('Timber edging board',(.04,dp-.08,.18),(x*(w/2-.02),0,.09),.006,timber)
    d.box('Raised bed soil',(w-.08,dp-.08,.15),(0,0,.075),.01,soil)
    for n in range(42):
        x=(rng.random()-.5)*(w-.22);y=(rng.random()-.5)*(dp-.2);top=.30+.14*rng.random()
        k.tube('Flower stem',[(x,y,.12),(x+.01,y,top)],.004,stem)
        blob('Flower head',(x+.01,y,top),.03+.015*rng.random(),.7,petals[n%4],seed=n,detail=1)
    for n in range(14):
        x=(rng.random()-.5)*(w-.25);y=(rng.random()-.5)*(dp-.25)
        blob('Leaf clump',(x,y,.18),.09,.6,fresh,seed=80+n,detail=1)
    return f.ground(.45)


def water_lilies():
    s.parts.clear();rng=random.Random(6)
    spots=[(-.17,.14,.16),(.14,.15,.14),(.18,-.12,.17),(-.15,-.15,.13),(0,0,.15),(.02,.24,.1)]
    for n,(x,y,r) in enumerate(spots):
        notch=rng.random()*math.tau;verts=[(x,y,.01)];faces=[]
        steps=28
        for j in range(steps+1):
            ang=notch+.35+j*(math.tau-.7)/steps;verts.append((x+r*math.cos(ang),y+r*math.sin(ang),.012))
        for j in range(steps):faces.append((0,j+1,j+2))
        top=s.mesh('Floating lily pad',verts,faces,pad)
        mod=top.modifiers.new('Pad thickness','SOLIDIFY');mod.thickness=.008;bpy.context.view_layer.objects.active=top;bpy.ops.object.modifier_apply(modifier=mod.name)
    for x,y in ((.0,.0),(.18,-.12)):
        for ring,(count,length,lift) in enumerate(((10,.075,.35),(8,.055,.7))):
            for j in range(count):
                ang=j*math.tau/count+ring*.3
                tip=(x+length*math.cos(ang),y+length*math.sin(ang),.03+length*lift)
                k.tube('Lily petal',[(x,y,.015),tip],.012,bloom)
        blob('Lily stamens',(x,y,.04),.016,.8,petals[1],seed=3,detail=1)
    return f.ground(.08)


def fish():
    s.parts.clear()
    rows=[]
    for i in range(17):
        t=i/16;x=-.17+.34*t;r=.055*math.sin(math.pi*min(1,t*1.15))**.8+.004
        rows.append((x,r))
    verts=[];faces=[];n=20
    for x,r in rows:
        for j in range(n):
            ang=j*math.tau/n;verts.append((x,r*math.cos(ang)*.72,r*math.sin(ang)))
    for i in range(len(rows)-1):
        for j in range(n):faces.append((i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j))
    faces.append(tuple(range(n)));faces.append(tuple(reversed(range((len(rows)-1)*n,len(rows)*n))))
    s.mesh('Koi body',verts,faces,koi)
    blob('White head patch',(.1,0,.02),.045,.75,pearl,seed=2,detail=2)
    blob('White saddle patch',(-.03,0,.035),.04,.55,pearl,seed=5,detail=2)
    tail=s.mesh('Tail fin',[(-.16,0,0),(-.23,0,.06),(-.25,0,.0),(-.23,0,-.06)],[(0,1,2,3)],fin)
    dorsal=s.mesh('Dorsal fin',[(.04,0,.05),(-.08,0,.05),(-.06,0,.085)],[(0,1,2)],fin)
    for side in (-1,1):
        s.mesh('Pectoral fin',[(.07,side*.03,-.02),(.03,side*.03,-.025),(.04,side*.075,-.04)],[(0,1,2)],fin)
        blob('Koi eye',(.11,side*.012,.008),.006,1,eye,seed=1,detail=1)
    for o in s.parts:
        if o.name.startswith(('Tail','Dorsal','Pectoral')):
            m=o.modifiers.new('Fin thickness','SOLIDIFY');m.thickness=.003;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=m.name)
    return f.ground(.1)


def render(name):
    node=leaves.node_tree.nodes.get('Principled BSDF');old=tuple(node.inputs['Base Color'].default_value)
    node.inputs['Base Color'].default_value=(.16,.34,.12,1)
    bnode=bloom.node_tree.nodes.get('Principled BSDF');bold=tuple(bnode.inputs['Base Color'].default_value)
    bnode.inputs['Base Color'].default_value=(.62,.55,.85,1)
    knode=koi.node_tree.nodes.get('Principled BSDF');kold=tuple(knode.inputs['Base Color'].default_value)
    knode.inputs['Base Color'].default_value=(.85,.32,.08,1)
    b.render(name)
    node.inputs['Base Color'].default_value=old;bnode.inputs['Base Color'].default_value=bold;knode.inputs['Base Color'].default_value=kold


MODELS=[('tree-deciduous-lime',deciduous,leaves),('tree-birch-twin',birch,leaves),('tree-spruce',conifer,leaves),
        ('shrub-round',shrub,leaves),('shrub-hydrangea',flowering,bloom),('hedge-clipped',hedge,leaves),
        ('grass-ornamental',grass,leaves),('flower-bed-raised',flower_bed,timber),('water-lilies',water_lilies,bloom),('fish-koi',fish,koi)]


def main():
    d.render=render
    requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
    for name,build,body in MODELS:
        if not requested or name in requested:d.export(name,build,body)


if __name__=='__main__':main()
