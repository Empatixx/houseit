"""Original chaise, wingback with ottoman and fitted shelving module.

Metres, +Y front, Z=0 floor. Original geometry and textile patterns only.
"""
import importlib.util
import math
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('storage',Path(__file__).with_name('make-bedroom-storage.py'))
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
d,s=b.d,b.s
SOURCE=s.ROOT/'assets/lounge'
SOURCE.mkdir(parents=True,exist_ok=True)
b.SOURCE=d.SOURCE=SOURCE
d.render=b.render
paint=b.paint
dark_wood=d.material('Dark stained timber feet',(.075,.048,.029),.83)


def seam(name,points,radius=.0011):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.bevel_depth=radius;curve.bevel_resolution=2
    line=curve.splines.new('POLY');line.points.add(len(points)-1)
    for p,co in zip(line.points,points):p.co=(*co,1)
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    bpy.ops.object.convert(target='MESH');obj=bpy.context.object;obj.data.materials.append(s.fabric)
    s.parts.append(obj)


def foot(name,x,y,h=.225):
    # Horizontal end faces put all four wooden feet on the same floor plane.
    verts=[]
    for z,r in ((0,.014),(h,.027)):
        for i in range(20):
            a=i*math.tau/20
            verts.append((x+r*math.cos(a),y+r*math.sin(a),z))
    faces=[tuple(reversed(range(20))),tuple(range(20,40))]
    faces += [(i,(i+1)%20,(i+1)%20+20,i+20) for i in range(20)]
    s.mesh(name,verts,faces,dark_wood)


def chaise():
    s.parts.clear()
    for x in (-.265,.265):
        for y in (-.777,.777):d.box('Chaise recessed foot',(.058,.065,.050),(x,y,.025),.007,d.black)
    d.box('Soft upholstered chaise base',(.650,1.745,.300),(0,0,.185),.025)
    d.box('Upholstered back support',(.647,.128,.472),(0,-.808,.535),.033)
    s.cushion('Full-length sewn seat',.651,1.595,.135,(0,.061,.380),seed=310,resolution=112)
    s.cushion('Loose full-width back cushion',.632,.444,.150,(0,-.731,.606),angle=math.radians(-78),seed=311,resolution=96)
    outline=s.rounded_rect(.649,1.744,.027,112)
    s.piping('Base lower sewn seam',outline,0,lambda v:(v[0],v[1],v[2]+.052),.0009)
    return s.parts


def loft(name,sections,axis):
    """Soft closed padded profile with broad faces and rounded cross sections."""
    controls=[Vector((*centre,width,height)) for centre,width,height in sections]
    samples=[]
    for i in range(len(controls)-1):
        a,b0,c,e=controls[max(0,i-1)],controls[i],controls[i+1],controls[min(len(controls)-1,i+2)]
        for j in range(8):
            t=j/8
            v=.5*((2*b0)+(-a+c)*t+(2*a-5*b0+4*c-e)*t*t+(-a+3*b0-3*c+e)*t*t*t)
            samples.append((tuple(v[:3]),max(.002,v[3]),max(.002,v[4])))
    sections=samples+[sections[-1]]
    verts=[];count=48
    for centre,width,height in sections:
        for j in range(count):
            a=j*math.tau/count
            xx=width/2*math.copysign(abs(math.cos(a))**.55,math.cos(a))
            yy=height/2*math.copysign(abs(math.sin(a))**.55,math.sin(a))
            offset=Vector((xx,0,yy) if axis=='y' else (xx,yy,0))
            verts.append(Vector(centre)+offset)
    faces=[]
    for row in range(len(sections)-1):
        for j in range(count):faces.append((row*count+j,row*count+(j+1)%count,(row+1)*count+(j+1)%count,(row+1)*count+j))
    faces += [tuple(reversed(range(count))),tuple(range((len(sections)-1)*count,len(sections)*count))]
    obj=s.mesh(name,verts,faces)
    if axis=='y':
        a=math.pi/3 if sections[0][0][0]>0 else 2*math.pi/3
        xx=math.copysign(abs(math.cos(a))**.55,math.cos(a))
        zz=abs(math.sin(a))**.55
        seam('Arm upper upholstery seam',[(p[0]+width/2*xx,p[1],p[2]+height/2*zz) for p,width,height in sections])
    return obj


def padded_back(centre,angle):
    # A regular surface grid keeps the local button dimples smooth and compact.
    nx,ny=64,112;w,h=.700,.840;r=.050
    c,si=math.cos(angle),math.sin(angle)
    def transform(x,y,z):return centre+Vector((x,c*y-si*z,si*y+c*z))
    verts=[]
    for front in (False,True):
        for j in range(ny+1):
            v=-1+2*j/ny;y=v*h/2
            corner=max(0,abs(y)-(h/2-r))
            half=w/2-r+math.sqrt(max(0,r*r-corner*corner))
            for i in range(nx+1):
                u=-1+2*i/nx;x=u*half
                fullness=max(0,(1-u**4)*(1-v**4))**.65
                z=.024+.079*fullness if front else -.024-.035*fullness
                if front:
                    z-=sum(.013*math.exp(-((x-bx)/.023)**2-((y+.075)/.022)**2) for bx in (-.224,-.112,0,.112,.224))
                verts.append(transform(x,y,z))
    faces=[];count=(nx+1)*(ny+1)
    for side in (0,count):
        for j in range(ny):
            for i in range(nx):
                k=side+j*(nx+1)+i
                faces.append((k,k+1,k+nx+2,k+nx+1))
    boundary=list(range(nx+1))+[j*(nx+1)+nx for j in range(1,ny+1)]
    boundary+=list(range(ny*(nx+1)+nx-1,ny*(nx+1)-1,-1))
    boundary+=[j*(nx+1) for j in range(ny-1,0,-1)]
    for i,a in enumerate(boundary):
        z=boundary[(i+1)%len(boundary)]
        faces.append((a,z,z+count,a+count))
    obj=s.mesh('Tall padded back',verts,faces)
    outline=s.rounded_rect(w,h,r,144)
    s.piping('Back stitched edge',outline,.024,lambda v:transform(*v))
    return obj


def wingback():
    s.parts.clear()
    for x in (-.278,.278):
        for y in (-.541,.100):foot('Wingback timber foot',x,y)
    d.box('Padded chair foundation',(.694,.738,.210),(0,-.232,.292),.036)
    angle=math.radians(-82);centre=Vector((0,-.602,.632))
    back=padded_back(centre,angle)
    for side in (-1,1):
        x=side*.340
        arm=[((x,.197,.475),.020,.040),((x,.185,.475),.106,.350),
             ((x,.155,.475),.154,.430),((x,.080,.467),.148,.415),
             ((x,-.120,.431),.132,.346),((x,-.320,.432),.122,.365),
             ((x,-.488,.499),.112,.472),((x,-.543,.522),.065,.400)]
        loft('Sculpted upholstered arm',arm,'y')
        wings=[((x,-.484,.494),.050,.090),((x,-.499,.556),.111,.225),
               ((x,-.515,.682),.134,.249),((side*.353,-.550,.871),.128,.264),
               ((side*.353,-.581,1.039),.113,.233),((side*.349,-.584,1.078),.079,.171),
               ((side*.348,-.584,1.092),.026,.060)]
        loft('Rounded upholstered back wing',wings,'z')
    s.cushion('Separate boxed seat cushion',.572,.632,.111,(0,-.145,.425),seed=322,resolution=96)
    # Locate buttons on the actual sculpted front surface, with their backs buried.
    bm=bmesh.new();bm.from_mesh(back.data);tree=BVHTree.FromBMesh(bm);bm.free()
    for x in (-.224,-.112,0,.112,.224):
        hit,normal,_,_=tree.ray_cast(Vector((x,.5,.719)),Vector((0,-1,0)))
        assert hit is not None
        obj=d.cylinder('Fabric covered back button',.0065,.004,hit+Vector((0,.0005,0)),s.fabric,24)
        obj.rotation_euler.x=math.pi/2
    # Ottoman is a deliberately separate object, included in the same catalogue model.
    for x in (-.223,.223):
        for y in (.338,.652):foot('Ottoman timber foot',x,y,.180)
    d.box('Ottoman padded foundation',(.552,.450,.197),(0,.495,.270),.022)
    s.cushion('Ottoman sewn top cushion',.568,.458,.110,(0,.495,.407),seed=323,resolution=80)
    return s.parts


def shelving():
    s.parts.clear()
    w=.940
    d.box('Continuous fitted plinth',(w,.348,.090),(0,-.014,.045),.003,paint)
    for z in (.102,.802):d.box('Lower cabinet base and top',(w,.364,.024),(0,-.007,z),.004,paint)
    for side in (-1,1):
        d.box('Lower cabinet side',(.024,.329,.700),(side*.445,-.0245,.452),.003,paint)
    d.box('Lower cabinet rear',(.896,.013,.700),(0,-.183,.452),.002,paint)
    d.box('Lower internal shelf',(.896,.332,.018),(0,-.018,.450),.003,paint)
    for side in (-1,1):
        x=side*.222
        b.panel('Recessed-panel lower door frame',.431,.660,.023,(x,.151,.450),paint,
                r=.006,opening=(.335,.564,.004,0))
        d.box('Inset lower door panel',(.355,.012,.584),(x,.143,.450),.003,paint)
        for z in (.198,.692):d.box('Concealed lower door hinge',(.030,.053,.037),(x+side*.198,.132,z),.002,paint)
        knob=d.cylinder('Door knob neck',.006,.020,(side*.029,.168,.456),d.black,24);knob.rotation_euler.x=math.pi/2
        knob=d.cylinder('Round door knob',.012,.012,(side*.029,.181,.456),d.black,32);knob.rotation_euler.x=math.pi/2
    for side in (-1,1):
        d.box('Upper shelving side',(.025,.291,1.290),(side*.445,-.0435,1.450),.003,paint)
        d.box('Upper fitted side trim',(.041,.016,1.281),(side*.449,.105,1.4535),.003,paint)
    for z in (.823,1.140,1.457,1.774,2.088):
        d.box('Upper fixed shelf',(.895,.289,.023),(0,-.0425,z),.003,paint)
        if z<2.0:d.box('Shelf rear upstand',(.895,.016,.067),(0,-.177,z+.042),.003,paint)
    d.box('Fitted top cornice',(w,.316,.022),(0,-.037,2.089),.003,paint)
    return s.parts


def main():
    requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
    for name,build,body in [
        ('chaise-soft',chaise,s.fabric),
        ('wingback-with-ottoman',wingback,s.fabric),
        ('shelving-fitted',shelving,paint),
    ]:
        if not requested or name in requested:d.export(name,build,body)


if __name__=='__main__':main()
