"""Original framed glass showers with real trays and wall-mounted shower fittings."""
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
SOURCE=s.ROOT/'assets/showers';SOURCE.mkdir(parents=True,exist_ok=True)
b.SOURCE=d.SOURCE=SOURCE;d.render=b.render
frame=d.material('Editable shower frame',(1,1,1),.66);frame['houseitTexture']='tint'
glass=d.material('Clear shower glass',(.72,.86,.86),.18,.08)
node=glass.node_tree.nodes.get('Principled BSDF');node.inputs['Alpha'].default_value=.18
glass.diffuse_color=(.72,.86,.86,.18);glass.surface_render_method='DITHERED'
edge=d.material('Subtle glass edge',(.48,.60,.59),.45,.10)
seal=d.material('Shower door seals',(.42,.47,.46),.7)


def build(w,depth):
    s.parts.clear()
    rows=[(w-.01,depth-.01,0,.018,0,0),(w,depth,.01,.020,0,0),(w,depth,.053,.022,0,0),
      (w-.01,depth-.01,.060,.023,0,0),(w-.066,depth-.066,.060,.026,0,0),
      (w-.077,depth-.077,.052,.029,0,0),(w-.105,depth-.105,.031,.035,0,0),(.08,.08,.027,.039,-w/2+.15,-depth/2+.15)]
    tray=f.loft('Continuous low ceramic shower tray',rows,f.ceramic)
    f.drain(-w/2+.15,-depth/2+.15,.032,.035,shell=tray)
    zlow,ztop=.070,1.9
    for x,y in [(-w/2+.015,depth/2-.015),(w/2-.015,-depth/2+.015)]:
        d.box('Wall jamb',(.030,.030,ztop-.053),(x,y,(ztop+.053)/2),.004,frame)
    for z,h in [(.075,.032),(1.880,.040)]:
        d.box('Front sliding door track',(w-.018,.033,h),(0,depth/2-.020,z),.005,frame)
        d.box('Side sliding door track',(.033,depth-.018,h),(w/2-.020,0,z),.005,frame)
    # Two half-width panels on each side, with a small physical overlap.
    for j in range(2):
        x=-w/2+.026+(j+.5)*(w-.052)/2;yy=depth/2-(.026 if j==0 else .018)
        panel_w=(w-.052)/2+.012
        d.box('Front clear glass pane',(panel_w,.006,1.786),(x,yy,.977),.001,glass)
        ex=x+panel_w/2-.003
        d.box('Front vertical glass edge',(.005,.008,1.786),(ex,yy,.977),.001,edge)
        y=-depth/2+.026+(j+.5)*(depth-.052)/2;xx=w/2-(.026 if j==0 else .018)
        panel_d=(depth-.052)/2+.012
        d.box('Side clear glass pane',(.006,panel_d,1.786),(xx,y,.977),.001,glass)
        ey=y+panel_d/2-.003
        d.box('Side vertical glass edge',(.008,.005,1.786),(xx,ey,.977),.001,edge)
    # Corner meeting strips and pulls are connected to the moving glass leaves.
    for x,y in [(w/2-.080,depth/2-.018),(w/2-.018,depth/2-.080)]:
        for z in (.98,1.14):d.box('Door pull clamp',(.018,.018,.018),(x,y,z),.004,f.metal)
    k.tube('Front door rounded pull',[(w/2-.080,depth/2-.018,.98),(w/2-.080,depth/2-.050,.98),(w/2-.080,depth/2-.050,1.14),(w/2-.080,depth/2-.018,1.14)],.009,f.metal)
    k.tube('Side door rounded pull',[(w/2-.018,depth/2-.080,.98),(w/2-.050,depth/2-.080,.98),(w/2-.050,depth/2-.080,1.14),(w/2-.018,depth/2-.080,1.14)],.009,f.metal)
    k.tag(0,'Shower tray and frame')
    start=len(s.parts);x=-w/2+.065
    # The catalogue shower is installed against the left wall; these are wall fittings.
    for y in (-.075,.075):
        m=d.cylinder('Wall mixer escutcheon',.028,.012,(x-.059,y,.96),f.metal,40);m.rotation_euler.y=math.pi/2
        k.tube('Mixer wall inlet',[(x-.059,y,.96),(x+.027,y,.96)],.011,f.metal)
    k.tube('Thermostatic shower mixer',[(x+.027,-.13,.96),(x+.027,.13,.96)],.026,f.metal)
    for y in (-.128,.128):
        m=d.cylinder('Shower mixer control',.027,.041,(x+.027,y,.96),f.metal,40);m.rotation_euler.x=math.pi/2
    k.tube('Shower riser',[(x+.027,0,.98),(x+.027,0,1.766),(x+.038,0,1.794),(x+.064,0,1.807),(x+.35,0,1.807)],.011,f.metal)
    for z in (1.20,1.70):
        k.tube('Riser wall fixing',[(x-.060,0,z),(x+.027,0,z)],.014,f.metal)
        m=d.cylinder('Riser mounting plate',.025,.009,(x-.0605,0,z),f.metal,40);m.rotation_euler.y=math.pi/2
    d.cylinder('Rounded overhead shower head',.106,.014,(x+.35,0,1.795),f.metal,80)
    d.cylinder('Shower nozzle face',.098,.008,(x+.35,0,1.785),f.drain_dark,64)
    for ring,n in [(.034,10),(.065,18),(.089,24)]:
        for j in range(n):
            angle=math.tau*j/n
            d.cylinder('Shower rubber nozzle',.0024,.004,(x+.35+ring*math.cos(angle),ring*math.sin(angle),1.779),f.seat,10)
    # Flexible hand-shower hose follows a smooth, restrained hanging U.
    points=[(x+.045,.065,.935)]
    points += [(x+.055,.065+.15*(j/30),.935-.39*math.sin(math.pi*j/30)+.35*(j/30)) for j in range(31)]
    k.tube('Flexible shower hose',points,.006,f.metal)
    k.tube('Hand shower stem',[(x+.055,.215,1.275),(x+.07,.215,1.425)],.014,f.metal)
    d.box('Hand shower face',(.026,.064,.104),(x+.084,.215,1.448),.014,f.seat)
    k.tube('Hand shower holder',[(x+.027,0,1.38),(x+.055,.215,1.38)],.012,f.metal)
    k.tag(start,'Wall mounted shower mixer')
    for obj in s.parts[start:]:obj['wallMounted']=True
    return f.ground(1.9)


def main():
    requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
    for name,w,depth in [('shower-small-detailed',.838,.838),('shower-medium-detailed',1.143,1.143),('shower-large-detailed',1.549,.940)]:
        if not requested or name in requested:d.export(name,lambda:build(w,depth),frame)
if __name__=='__main__':main()
