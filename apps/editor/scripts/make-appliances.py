"""Original restrained kitchen appliances inspired by IKEA LAGAN details."""
import importlib.util
import math
import sys
from pathlib import Path
import bpy

sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('storage',Path(__file__).with_name('make-bedroom-storage.py'))
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
d,s=b.d,b.s
SOURCE=s.ROOT/'assets/appliances';SOURCE.mkdir(parents=True,exist_ok=True)
b.SOURCE=d.SOURCE=SOURCE;d.render=b.render
paint=d.material('Editable appliance enamel',(1,1,1),.64,.06);paint['houseitTexture']='tint'
seal=d.material('Graphite rubber seals',(.035,.040,.043),.92)
glass=d.material('Restrained dark glass',(.024,.033,.038),.37,.12)
steel=d.material('Satin hardware',(.39,.42,.44),.58,.40)
mark=d.material('Soft grey control markings',(.32,.34,.35),.88)
led=d.material('Muted indicator',(.25,.40,.43),.70)
cookerenamel=d.material('Black cooker enamel',(.018,.021,.025),.52,.10)
cookerhandle=d.material('Satin graphite cooker handle',(.12,.14,.16),.45,.40)
display=d.material('Quiet electronic display',(.63,.70,.71),.65)


def recess(obj,size,at,r=.009):
    cutter=d.box('Temporary recessed grip',size,at,r,paint)
    bpy.context.view_layer.objects.active=obj
    mod=obj.modifiers.new('Actual recessed grip','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    s.parts.remove(cutter);bpy.data.objects.remove(cutter,do_unlink=True)
    for face in obj.data.polygons:
        if max(abs(n) for n in face.normal)>.999:face.use_smooth=False
    normal=obj.modifiers.new('Recess weighted normals','WEIGHTED_NORMAL');normal.keep_sharp=True
    bpy.ops.object.modifier_apply(modifier=normal.name)


def feet(w,depth):
    for x in (-w/2+.055,w/2-.055):
        for y in (-depth/2+.055,depth/2-.055):d.cylinder('Adjustable appliance floor foot',.026,.048,(x,y,.024),seal,32)


def disc(name,x,y,z,r,thick,mat=paint):
    obj=d.cylinder(name,r,thick,(x,y,z),mat,32);obj.rotation_euler.x=math.pi/2;return obj


def ring(name,x,y,z,r,thickness=.0012,mat=mark,front=False):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.bevel_depth=thickness;curve.bevel_resolution=2
    line=curve.splines.new('POLY');line.points.add(63);line.use_cyclic_u=True
    for i,p in enumerate(line.points):
        a=i*math.tau/64;p.co=(x+r*math.cos(a),y if front else y+r*math.sin(a),z+r*math.sin(a) if front else z,1)
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    bpy.ops.object.convert(target='MESH');obj=bpy.context.object;obj.data.materials.append(mat);s.parts.append(obj)
    return obj


def fridge():
    s.parts.clear();w,depth=.711,.686
    feet(w,depth)
    d.box('Insulated refrigerator cabinet',(w,.636,1.765),(0,-.025,.9175),.009,paint)
    for name,z,h in [('Freezer',.323,.552),('Refrigerator',1.202,1.185)]:
        d.box(name+' door gasket',(w-.020,.018,h-.016),(0,.290,z),.005,seal)
        door=d.box(name+' softly rounded door',(w-.010,.056,h),(0,.312,z),.010,paint)
        recess(door,(.30,.038,.030),(.12,.341,.599 if name=='Freezer' else .610),.010)
        for zz in (z-h/2+.014,z+h/2-.014):
            d.box(name+' concealed hinge',(.027,.040,.021),(-w/2+.026,.284,zz),.005,steel)
    # A shallow rear compressor cover and restrained ventilation slots.
    d.box('Rear compressor cover',(w-.095,.012,.225),(0,-.339,.180),.005,seal)
    for i in range(9):d.box('Rear ventilation rib',(w-.15,.012,.008),(0,-.342,.095+i*.020),.003,steel)
    return s.parts


def dishwasher():
    s.parts.clear();w,depth=.635,.660
    feet(w,depth)
    d.box('Dishwasher steel cabinet',(w,.612,.785),(0,-.024,.4325),.005,paint)
    d.box('Soft edged dishwasher top',(w,depth,.025),(0,0,.8375),.006,paint)
    d.box('Door perimeter gasket',(w-.010,.012,.737),(0,.289,.444),.004,seal)
    d.box('Lower service plinth',(w-.003,.024,.077),(0,.310,.083),.004,paint)
    d.box('Large flush dishwasher door',(w-.010,.032,.592),(0,.313,.412),.006,paint)
    for x in (-w/2+.033,w/2-.033):d.box('Concealed dishwasher door support',(.020,.046,.738),(x,.289,.44),.003,steel)
    control=d.box('Upper fascia with inset grip',(w-.009,.039,.098),(0,.3085,.766),.005,paint)
    recess(control,(w-.105,.042,.029),(0,.338,.733),.014)
    for i in range(6):
        x=-.219+i*.061
        d.box('Small control button',(.022,.004,.013),(x,.328,.787),.003,paint)
        disc('Control indicator',x+.015,.328,.787,.0018,.004,mark)
    for i in range(4):d.box('Status indicator mark',(.012,.004,.002),(.175+i*.023,.328,.788),.001,mark)
    return s.parts


def label(name,text,at,size):
    curve=bpy.data.curves.new(name,'FONT');curve.body=text;curve.align_x='CENTER';curve.align_y='CENTER';curve.size=size;curve.extrude=.0003;curve.resolution_u=4
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj);obj.location=at;obj.rotation_euler=(math.pi/2,0,math.pi)
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj;bpy.ops.object.convert(target='MESH')
    obj=bpy.context.object;obj.data.materials.append(display);s.parts.append(obj)


def stove():
    s.parts.clear();w,depth=.762,.737
    feet(w,depth)
    d.box('Freestanding cooker cabinet',(w,.674,.842),(0,-.0275,.461),.007,cookerenamel)
    d.box('Lower storage drawer',(w-.012,.038,.145),(0,.322,.133),.005,cookerenamel)
    d.box('Oven door gasket',(w-.019,.014,.560),(0,.311,.492),.004,seal)
    for x in (-.343,.343):d.box('Concealed oven door hinge',(.026,.05,.54),(x,.317,.492),.004,steel)
    # Recessed dark pane in an actual opening, not over a solid front panel.
    b.panel('Eased oven door frame',w-.012,.558,.032,(0,.338,.492),cookerenamel,r=.008,
            opening=(w-.132,.378,.010,-.035))
    d.box('Dark oven window',(w-.119,.018,.391),(0,.337,.457),.008,glass)
    for x in (-.250,.250):d.box('Door pull mounting foot',(.030,.045,.028),(x,.355,.717),.008,cookerenamel)
    d.box('Rounded oven door pull',(.555,.025,.025),(0,.381,.717),.010,cookerhandle)
    d.box('Black glass electronic oven fascia',(w-.010,.031,.105),(0,.332,.824),.005,glass)
    label('Oven temperature display','180°',(0,.3474,.824),.023)
    for x in (-.21,-.16,.16,.21):
        ring('Subtle oven touch control',x,.3474,.825,.008,.0008,display,True)
    for x in (-.21,.21):d.box('Touch control stroke',(.011,.002,.0015),(x,.3474,.825),.0005,display)
    for i in range(14):d.box('Oven vent slot',(.033,.005,.004),(-.304+i*.047,.354,.763),.001,seal)
    d.box('Enamel cooktop rim',(w,depth,.024),(0,0,.888),.006,cookerenamel)
    d.box('Ceramic hob glass',(w-.033,depth-.045,.006),(0,0,.900),.010,glass)
    for x,y,r in [(-.177,-.175,.100),(.177,-.175,.078),(-.177,.145,.078),(.177,.145,.100)]:
        ring('Subtle induction cooking zone',x,y,.903,r,.0008,mark)
    for x in (-.19,-.065,.065,.19):
        ring('Hob electronic touch control',x,.300,.903,.007,.0008,display)
    d.box('Hob touch slider',(.105,.002,.0015),(0,.324,.903),.0005,display)
    return s.parts


def main():
    requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
    for name,build in [('fridge-freezer-classic',fridge),('dishwasher-classic',dishwasher),('cooker-ceramic-classic',stove)]:
        if not requested or name in requested:d.export(name,build,cookerenamel if build==stove else paint)

if __name__=='__main__':main()
