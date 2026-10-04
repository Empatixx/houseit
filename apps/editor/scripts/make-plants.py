"""Original botanical meshes: branched ficus, split-leaf monstera and fleshy jade."""
import importlib.util
import math
import random
import sys
from pathlib import Path
import bpy
from mathutils import Vector
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('lighting',Path(__file__).with_name('make-lighting.py'))
l=importlib.util.module_from_spec(spec);spec.loader.exec_module(l)
f,k,a,b,d,s=l.f,l.k,l.a,l.b,l.d,l.s
SOURCE=s.ROOT/'assets/plants';SOURCE.mkdir(parents=True,exist_ok=True)
b.SOURCE=d.SOURCE=SOURCE;d.render=b.render
leafmat=d.material('Editable matte foliage',(1,1,1),.76);leafmat['houseitTexture']='tint'
stemmat=d.material('Living petioles',(.12,.20,.055),.83)
bark=d.material('Quiet brown bark',(.20,.135,.077),.96)
potmat=d.material('Warm chalk ceramic',(.79,.76,.69),.88)
soil=d.material('Dark potting soil',(.068,.049,.030),1)


def pot(radius,height):
    l.lathe('Rounded ceramic planter',[(0,0),(radius*.79,0),(radius*.83,.008),(radius-.003,height-.01),(radius,height-.006),(radius,height-.002),(radius-.004,height),(radius-.010,height),(radius-.014,height-.006),(radius*.78,.021),(0,.021),(0,0)],potmat)
    d.cylinder('Recessed potting soil',radius-.010,.017,(0,0,height-.024),soil,64)


def leaf(name,origin,angle,length,width,pitch=.12,split=False,fleshy=False,seed=1):
    rng=random.Random(seed);o=Vector(origin);forward=Vector((math.cos(angle),math.sin(angle),0));side=Vector((-math.sin(angle),math.cos(angle),0))
    nt=80 if split else 20;nu=8;verts=[];faces=[];thickness=.006 if fleshy else .0012
    phase=rng.random()*math.tau
    for layer in (-1,1):
        for j in range(nt+1):
            t=j/nt
            shape=max(.002,math.sin(math.pi*t)**(.65 if fleshy else .80))
            if split:
                for c in (.20,.34,.48,.62,.76):shape*=1-.66*math.exp(-((t-c)/.012)**2)
            for i in range(nu+1):
                u=2*i/nu-1
                w=width*.5*shape*u
                pos=o+forward*(length*t)+side*(w+.018*length*math.sin(math.pi*t+phase)*t)
                arch=length*(pitch*t+.12*math.sin(math.pi*t)-.13*t*t)
                curl=length*(.07*abs(u)**1.7*math.sin(math.pi*t)+.012*math.sin(t*math.pi*4+phase)*u)
                pos.z+=arch-curl+layer*thickness*.5*(.12+.88*math.sin(math.pi*t)**.6)*(1-.70*abs(u))
                verts.append(tuple(pos))
    n=(nt+1)*(nu+1)
    for layer in range(2):
        off=layer*n
        for j in range(nt):
            for i in range(nu):
                p=off+j*(nu+1)+i;faces.append((p,p+1,p+nu+2,p+nu+1) if layer else (p+nu+1,p+nu+2,p+1,p))
    for j in range(nt):
        for i in (0,nu):
            p=j*(nu+1)+i;q=p+nu+1;faces.append((p,q,q+n,p+n))
    for j in (0,nt):
        for i in range(nu):
            p=j*(nu+1)+i;faces.append((p,p+n,p+n+1,p+1))
    obj=s.mesh(name,verts,faces,leafmat)
    if split:
        points=[]
        for j in range(21):
            t=j/20;pos=o+forward*(length*t)+side*(.018*length*math.sin(math.pi*t+phase)*t)
            pos.z+=length*(pitch*t+.12*math.sin(math.pi*t)-.13*t*t)+.0005
            points.append(pos)
        k.tube('Subtle leaf midrib',points,.00065,stemmat)
    return obj


def ficus(R=1):
    s.parts.clear();pot(.14,.26);rng=random.Random(62)
    trunk=[(0,0,.02),(.005,.014,.35),(-.018,.012,.65),(.012,-.015,.95),(-.005,.002,1.10)]
    k.tube('Gently bent woody trunk',trunk,.012,bark)
    for j in range(13):
        t=.21+j*.054;z=.26+t*.78
        segment=next((idx for idx in range(len(trunk)-1) if trunk[idx][2]<=z<=trunk[idx+1][2]),0)
        low,high=Vector(trunk[segment]),Vector(trunk[segment+1]);pos=low.lerp(high,(z-low.z)/(high.z-low.z));angle=j*2.399
        span=.32*R*(1-.58*j/13);end=pos+Vector((math.cos(angle)*span,math.sin(angle)*span,.10+.05*rng.random()))
        mid=pos.lerp(end,.55)+Vector((0,0,-.014));k.tube('Rising ficus branch',[pos,mid,end],.0045,bark)
        for v in range(4):
            at=mid.lerp(end,v/4)
            for sign in (-1,1):
                direction=angle+sign*(.62+.25*rng.random());tip=at+Vector((math.cos(direction)*.04,math.sin(direction)*.04,.024))
                k.tube('Fine attached ficus twig',[at,tip],.0017,bark)
                leaf('Curved pointed ficus leaf',tip,direction,.13+rng.random()*.025,.048+rng.random()*.014,pitch=.1+rng.random()*.3,seed=j*16+v*2+sign)
        leaf('Ficus branch terminal leaf',end,angle,.135,.054,pitch=.24,seed=j+100)
    for j in range(6):
        at=Vector(trunk[-1]).lerp(Vector(trunk[-2]),j*.023/(trunk[-1][2]-trunk[-2][2]));tip=at+Vector((math.cos(j*2.399)*.032,math.sin(j*2.399)*.032,.012))
        k.tube('Ficus crown twig',[at,tip],.0018,bark)
        leaf('Ficus crown leaf',tip,j*2.399,.09,.043,pitch=.35,seed=j+200)
    k.tag(0,'Ficus plant');return s.parts


def monstera(R=1):
    s.parts.clear();pot(.13,.225)
    for j in range(9):
        angle=j*2.399;z=.36+j*.045;reach=(.12+.02*(j%3))*R;tip=(math.cos(angle)*reach,math.sin(angle)*reach,z)
        origin=(.021*math.cos(angle),.021*math.sin(angle),.04)
        mid=(tip[0]*.25,tip[1]*.25,z*.7)
        k.tube('Curved monstera petiole',[origin,mid,tip],.0042,stemmat)
        leaf('Sculpted split monstera leaf',tip,angle,(.29+.018*(j%3))*R,.235*R,pitch=.14+j*.02,split=j>1,seed=j+400)
    k.tag(0,'Monstera plant');return s.parts


def jade(R=1):
    s.parts.clear();g=R**.5;pot(.12*g,.17)
    k.tube('Jade main stem',[(0,0,.02),(0,0,.23),(.01,0,.37)],.013,stemmat)
    for j in range(7):
        angle=j*2.399;z=.205+(j%3)*.047;reach=(.085+(j%2)*.025)*R
        origin=Vector((0,0,z));tip=Vector((math.cos(angle)*reach,math.sin(angle)*reach,z+.045))
        k.tube('Jade succulent branch',[origin,tip],.007,stemmat)
        for t in (.35,.75,1):
            at=origin.lerp(tip,t)
            for sign in (-1,1):leaf('Fleshy rounded jade leaf',at,angle+sign*.62,.105*g,.059*g,pitch=.4+t*.12,fleshy=True,seed=j*20+int(t*10)+sign)
    for j in range(4):leaf('Upright jade crown leaf',(.01,0,.363),j*math.pi/2,.07,.045,pitch=1,fleshy=True,seed=j)
    k.tag(0,'Jade plant');return s.parts


def extent(parts):
    bpy.context.view_layer.update()
    points=[o.matrix_world @ v.co for o in parts for v in o.data.vertices]
    return max(max(p[i] for p in points)-min(p[i] for p in points) for i in (0,1))


def fit(build,width,height):
    R=1
    for attempt in range(6):
        parts=build(R);measured=extent(parts)
        if abs(measured-width)<.003 or attempt==5:break
        for obj in list(parts):bpy.data.objects.remove(obj,do_unlink=True)
        R*=(width/measured)**1.2
    print('fitted',round(R,3),round(measured,4),flush=True)
    return f.ground(height)


def render(name):
    node=leafmat.node_tree.nodes.get('Principled BSDF');old=tuple(node.inputs['Base Color'].default_value)
    node.inputs['Base Color'].default_value=(.12,.25,.09,1);b.render(name);node.inputs['Base Color'].default_value=old


def main():
    d.render=render
    requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
    for name,build in [('plant-ficus-detailed',lambda:fit(ficus,1.067,1.3)),('plant-monstera-detailed',lambda:fit(monstera,.838,.9)),('plant-jade-detailed',lambda:fit(jade,.66,.5))]:
        if not requested or name in requested:d.export(name,build,leafmat)
if __name__=='__main__':main()
