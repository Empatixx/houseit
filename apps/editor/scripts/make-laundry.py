"""Original front-loading laundry machines, side-by-side and in a supported stack."""
import importlib.util
import math
import sys
from pathlib import Path
import bpy
from mathutils import Matrix
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('bathroom',Path(__file__).with_name('make-bathroom.py'))
f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
k,a,b,d,s=f.k,f.a,f.b,f.d,f.s
SOURCE=s.ROOT/'assets/laundry';SOURCE.mkdir(parents=True,exist_ok=True)
b.SOURCE=d.SOURCE=SOURCE;d.render=b.render
paint=d.material('Editable laundry enamel',(1,1,1),.64,.03);paint['houseitTexture']='tint'
steel=d.material('Restrained drum steel',(.34,.38,.40),.54,.42)
window=d.material('Smoked laundry window',(.31,.38,.41),.30,.06)
window.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.28
window.diffuse_color=(.31,.38,.41,.28);window.surface_render_method='DITHERED'
white=d.material('Soft white laundry trim',(.91,.92,.91),.60)


def radial(name,rows,x,z,mat,caps=False):
    n=80;verts=[];faces=[]
    for r,y in rows:
        for j in range(n):
            t=math.tau*j/n;verts.append((x+r*math.cos(t),y,z+r*math.sin(t)))
    for row in range(len(rows)-1):
        for j in range(n):faces.append((row*n+j,row*n+(j+1)%n,(row+1)*n+(j+1)%n,(row+1)*n+j))
    if caps is True:faces.append(tuple(reversed(range(n))))
    if caps:faces.append(tuple(range((len(rows)-1)*n,len(rows)*n)))
    return s.mesh(name,verts,faces,mat)


def machine(dryer=False):
    w=.737;depth=.889;start=len(s.parts);cy=-.029
    a.feet(w,depth)
    for x in (-(w-.024)/2,(w-.024)/2):d.box('Laundry side panel',(.024,.831,.793),(x,cy,.4365),.008,paint)
    d.box('Laundry rear panel',(w-.022,.022,.793),(0,-depth/2+.011,.4365),.006,paint)
    d.box('Laundry base chassis',(w-.016,.832,.022),(0,cy,.046),.005,steel)
    d.box('Laundry eased top',(w,.851,.025),(0,-.019,.8375),.007,paint)
    face=d.box('Front enamel panel with real opening',(w-.014,.031,.650),(0,.383,.363),.006,paint)
    cutter=d.cylinder('Temporary circular door opening',.196,.12,(0,.383,.425),steel,80);cutter.rotation_euler.x=math.pi/2
    bpy.context.view_layer.objects.active=face;mod=face.modifiers.new('Through loading aperture','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name);s.parts.remove(cutter);bpy.data.objects.remove(cutter,do_unlink=True)
    for p in face.data.polygons:
        if max(abs(n) for n in p.normal)>.999:p.use_smooth=False
    d.box('Upper control fascia',(w-.014,.039,.137),(0,.383,.7605),.005,paint)
    # Real drum depth behind the door, with a softly detailed perforated back.
    radial('Laundry inner drum',[(.201,.395),(.199,.387),(.194,.22),(.178,.204),(.025,.201)],0,.425,steel,caps='end')
    for ring,n in [(.052,12),(.095,22),(.138,30),(.171,36)]:
        for j in range(n):
            t=math.tau*j/n
            dot=d.cylinder('Subtle drum perforation',.0025,.004,(ring*math.cos(t),.202+(ring-.025)/.153*.003,.425+ring*math.sin(t)),a.seal,12);dot.rotation_euler.x=math.pi/2
    for j in range(3):
        t=math.tau*j/3
        obj=d.box('Drum lifting paddle',(.028,.16,.034),(.177*math.cos(t),.303,.425+.177*math.sin(t)),.01,steel)
        obj.rotation_euler.y=math.pi/2-t
    radial('Door rubber bellows',[(.216,.391),(.212,.403),(.195,.407),(.187,.39),(.185,.366),(.197,.36),(.216,.391)],0,.425,a.seal)
    radial('Rounded laundry door bezel',[(.248,.392),(.260,.403),(.262,.421),(.251,.439),(.243,.4445),(.185,.440),(.179,.427),(.184,.410),(.198,.398),(.248,.392)],0,.425,paint if dryer else a.glass)
    # A subtly curved transparent window leaves the inner drum visible.
    radial('Concave smoked door glass',[(.186,.429),(.179,.431),(.143,.416),(.08,.405),(.001,.401)],0,.425,window,caps='end')
    d.box('Door hinge support',(.026,.057,.070),(-.227,.389,.425),.008,steel)
    d.box('Inset door grip',(.021,.012,.081),(.236,.443,.425),.009,a.seal)
    # Quiet controls without brand marks: detergent drawer, selector and dark display.
    d.box('Detergent drawer joint',(.208,.006,.103),(-.239,.405,.765),.003,a.seal)
    drawer=d.box('Detergent drawer face',(.202,.013,.098),(-.239,.409,.765),.004,paint)
    a.recess(drawer,(.16,.020,.023),(-.239,.418,.751),.009)
    a.disc('Program selector surround',-.069,.408,.768,.049,.014,steel)
    a.disc('Rounded program selector',-.069,.420,.768,.040,.022,white if dryer else a.glass)
    d.box('Selector position mark',(.003,.002,.009),(-.069,.4305,.800),.001,a.mark)
    for j in range(9):
        t=-math.pi*.7+j*math.pi*1.4/8
        a.disc('Selector program tick',-.069+.061*math.sin(t),.4035,.768+.061*math.cos(t),.0015,.004,a.mark)
    d.box('Recessed electronic display',(.235,.010,.089),(.185,.407,.770),.005,a.glass)
    a.label('Quiet remaining time','1:25',(.209,.4118,.781),.023)
    for x in (.103,.142,.181,.220,.259):d.box('Soft touch key marker',(.015,.002,.002),(x,.4125,.747),.001,a.display)
    if dryer:
        d.box('Dryer service filter joint',(w-.020,.010,.108),(0,.397,.105),.004,a.seal)
        d.box('Dryer lower service panel',(w-.025,.014,.103),(0,.403,.105),.004,paint)
        d.box('Dryer filter grip',(.075,.005,.010),(0,.412,.146),.004,steel)
        for j in range(7):d.box('Dryer ventilation slot',(.185,.003,.004),(.18,.4105,.076+j*.011),.002,a.mark)
    else:
        a.disc('Filter access cover joint',.213,.402,.139,.066,.007,a.seal)
        a.disc('Round filter access cover',.213,.407,.139,.063,.012,paint)
        d.box('Filter access grip',(.023,.004,.006),(.213,.414,.186),.002,steel)
    # A discreet rear service panel is connected to the chassis.
    d.box('Rear service hatch',(w-.13,.006,.42),(0,-.444,.30),.006,steel)
    k.tag(start,'Dryer' if dryer else 'Washer')


def build(stacked=False):
    s.parts.clear();machine(False);bpy.context.view_layer.update()
    if stacked:
        # Two taller cabinets joined by a load-bearing stacking kit.
        for obj in s.parts:
            obj.data.transform(Matrix.Diagonal((1,1,.932/.85,1)) @ obj.matrix_world);obj.matrix_world=Matrix.Identity(4)
        start=len(s.parts);machine(True);bpy.context.view_layer.update()
        for obj in s.parts[start:]:
            obj.data.transform(Matrix.Translation((0,0,.968)) @ Matrix.Diagonal((1,1,.932/.85,1)) @ obj.matrix_world);obj.matrix_world=Matrix.Identity(4)
        start=len(s.parts)
        d.box('Stacking kit load platform',(.729,.833,.036),(0,-.026,.950),.005,white)
        for x in (-.350,.350):d.box('Stacking kit retaining edge',(.012,.815,.063),(x,-.026,.9615),.003,white)
        k.tag(start,'Stacking kit')
        return f.ground(1.9)
    for obj in s.parts:obj.location.x-=.406
    start=len(s.parts);machine(True)
    for obj in s.parts[start:]:obj.location.x+=.406
    return f.ground(.85)


def main():
    requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
    for name,stacked in [('laundry-pair-detailed',False),('laundry-stack-detailed',True)]:
        if not requested or name in requested:d.export(name,lambda:build(stacked),paint)
if __name__=='__main__':main()
