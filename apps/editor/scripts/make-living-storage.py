"""Original bookcase, sideboard and upholstered hall bench.

User-approved visual references are recorded in living-reference-selection.json.
Metres, +Y front, Z=0 floor. All geometry and textile patterns are generated here.
"""
import importlib.util
import math
import sys
from pathlib import Path
import bpy

sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('storage',Path(__file__).with_name('make-bedroom-storage.py'))
b=importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)
d,s=b.d,b.s
SOURCE=s.ROOT/'assets/living-storage'
SOURCE.mkdir(parents=True,exist_ok=True)
b.SOURCE=d.SOURCE=SOURCE
d.render=b.render
paint=b.paint
oak=d.material('Pale natural oak',(1,1,1),.83)
# Bake this fixed finish into our own tiny grain tile, matching Blender and glTF.
pixels=d.np.array(d.wood_image.pixels[:]).reshape(s.N,s.N,4)
pixels[:,:,:3]*=d.np.array([.78,.67,.51])
tex=oak.node_tree.nodes.new('ShaderNodeTexImage');tex.image=s.texture('Original pale oak grain',pixels)
oak.node_tree.links.new(tex.outputs['Color'],oak.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
fixed_white=d.material('Warm painted bench',(.88,.87,.83),.86)


def timber(name,size,at,r=.003):
    obj=d.box(name,size,at,r,oak)
    for uv in obj.data.uv_layers.active.data:uv.uv*=.032
    return obj


def bookshelf():
    s.parts.clear()
    w,depth,h=.940,.330,1.800
    for x in (-(w-.019)/2,(w-.019)/2):
        d.box('Full-height bookcase side',(.019,depth,h),(x,0,h/2),.002,paint)
    d.box('Recessed back panel',(w-.030,.007,h-.025),(0,-depth/2+.014,h/2),.001,paint)
    d.box('Inset front plinth',(w-.030,.019,.075),(0,depth/2-.044,.0375),.002,paint)
    d.box('Inset rear plinth',(w-.030,.022,.075),(0,-depth/2+.030,.0375),.002,paint)
    # Six clear compartments; all shelves sit in the side panels and against the back.
    for i in range(7):
        z=.083+i*(h-.093)/6
        d.box('Bookcase shelf' if i<6 else 'Bookcase top',(w-.028,depth-.021,.019),(0,.006,z),.002,paint)
    return s.parts


def sideboard():
    s.parts.clear()
    w,depth,h=1.549,.559,.800
    inner=w-.036
    bay=inner/3
    # Four pairs of feet support both sides and both partitions.
    for x in (-w/2+.033,-bay/2,bay/2,w/2-.033):
        for y in (-depth/2+.041,depth/2-.044):
            timber('Square oak foot',(.042,.042,.112),(x,y,.056),.004)
    for z in (.112,h-.010):timber('Oak top and bottom',(w,depth-.019,.020),(0,-.0095,z))
    for x in (-(w-.022)/2,(w-.022)/2):
        timber('Oak outer side',(.020,depth-.021,.664),(x,-.0095,.452))
    timber('Cabinet back',(w-.025,.010,h-.120),(0,-depth/2+.008,(h+.112)/2))
    for x in (-bay/2,bay/2):
        timber('Vertical compartment partition',(.018,depth-.028,h-.128),(x,-.006,(h+.112)/2))
    for x in (-bay,bay):
        timber('Internal fixed shelf',(bay-.008,depth-.028,.018),(x,-.006,.457))
        d.box('Flat push-open door',(bay-.006,.021,.663),(x,depth/2-.0105,.4565),.003,paint)
        # The closed door is supported by concealed hinge plates, not floating geometry.
        for z in (.210,.685):
            timber('Concealed hinge block',(.036,.062,.036),(x+math.copysign(bay/2-.020,x),depth/2-.045,z))
    for z,height in ((.342,.434),(.677,.220)):
        d.box('Centre drawer front',(bay-.006,.021,height),(0,depth/2-.0105,z),.003,paint)
        timber('Drawer floor',(bay-.012,depth-.038,.016),(0,.003,z-height/2+.010))
        for x in (-bay/2+.018,bay/2-.018):
            timber('Drawer side and runner',(.025,depth-.047,height-.020),(x,.001,z))
    return s.parts


def knob(x,z):
    stem=d.cylinder('Drawer knob neck',.007,.022,(x,.197,z),d.black,24)
    stem.rotation_euler.x=math.pi/2
    head=d.cylinder('Round satin drawer knob',.014,.013,(x,.211,z),d.black,40)
    head.rotation_euler.x=math.pi/2


def bench():
    s.parts.clear()
    w,depth=2.032,.406
    # Painted frame, four continuous corner posts and a recessed storage drawer.
    for x in (-(w-.047)/2,(w-.047)/2):
        for y in (-(depth-.043)/2,(depth-.043)/2):
            d.box('Continuous corner post',(.047,.043,.395),(x,y,.1975),.006,fixed_white)
        d.box('Inset end panel',(.025,depth-.062,.292),(x,0,.239),.003,fixed_white)
    for z in (.110,.386):
        d.box('Lower rail and seat platform',(w-.034,depth-.024,.025),(0,0,z),.004,fixed_white)
    d.box('Bench back panel',(w-.034,.022,.285),(0,-depth/2+.020,.241),.003,fixed_white)
    for z in (.117,.352):
        d.box('Front cross rail',(w-.035,.034,.028),(0,depth/2-.025,z),.004,fixed_white)
    d.box('Wide inset drawer front',(w-.107,.024,.199),(0,.179,.236),.005,fixed_white)
    d.box('Recessed drawer panel',(w-.165,.008,.142),(0,.193,.236),.003,fixed_white)
    d.box('Drawer bottom',(w-.077,.348,.018),(0,.007,.145),.003,fixed_white)
    for x in (-(w-.073)/2,(w-.073)/2):
        d.box('Drawer side runner',(.030,.340,.190),(x,.003,.238),.003,fixed_white)
    for x in (-.46,.46):knob(x,.236)
    # Cushion underside compresses onto the solid seat. Piping and wrinkles are geometry.
    s.cushion('Long boxed seat cushion',w-.012,depth-.006,.076,(0,0,.422),seed=210,resolution=112)
    # Loose cushions rest on the seat, with their lowest points just inside its crown.
    for x,seed in ((-.730,211),(.720,212)):
        d.pillow('Loose hall cushion',.345,.270,.085,(x,-.040,.539),angle=math.radians(-57),seed=seed)
    return s.parts


def coffee_table():
    s.parts.clear()
    top=d.cylinder('Round solid-wood top',.457,.032,(0,0,.434),s.wood,128)
    for uv in top.data.uv_layers.active.data:uv.uv*=1.22
    shelf=d.cylinder('Round lower shelf',.36,.022,(0,0,.135),s.wood,128)
    for uv in shelf.data.uv_layers.active.data:uv.uv*=1.22
    for j in range(4):
        a=math.pi/4+j*math.pi/2;c,sn=math.cos(a),math.sin(a)
        s.tapered_leg('Tapered splayed table leg',(c*.36,sn*.36,.006),(c*.29,sn*.29,.420),.019,.030,s.wood)
    return s.parts


def side_table():
    s.parts.clear()
    w=.584
    d.box('Square solid-wood top',(w,w,.028),(0,0,.536),.012,s.wood)
    d.box('Lower slatted shelf',(w-.09,w-.09,.018),(0,0,.16),.004,s.wood)
    for x in (-1,1):
        for y in (-1,1):d.box('Square wooden leg',(.04,.04,.522),(x*(w/2-.035),y*(w/2-.035),.261),.006,s.wood)
        d.box('Shelf rail',(.022,w-.11,.03),(x*(w/2-.035),0,.16),.003,s.wood)
        d.box('Top apron',(w-.11,.02,.06),(0,x*(w/2-.035),.492),.003,s.wood)
    return s.parts


def main():
    requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
    for name,build,body in [
        ('coffee-table-round-oak',coffee_table,s.wood),
        ('side-table-square-oak',side_table,s.wood),
        ('bookshelf-classic',bookshelf,paint),
        ('sideboard-oak-white',sideboard,paint),
        ('bench-storage-cushioned',bench,s.fabric),
    ]:
        if not requested or name in requested:d.export(name,build,body)


if __name__=='__main__':main()
