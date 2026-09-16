"""Check laundry cabinet, door, drum and stacking-kit connections."""
import bpy
import bmesh
import json
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from pathlib import Path

root=Path(__file__).resolve().parents[3]
sources=sorted((root/'assets/laundry').glob('*.blend'))
assert len(sources)==2, 'Both laundry arrangements must be generated'
for source in sources:
    bpy.ops.wm.open_mainfile(filepath=str(source))
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    trees=[];bounds=[]
    for o in objects:
        assert o.get('component'), f'{source.stem}: unowned part {o.name}'
        bm=bmesh.new();bm.from_mesh(o.data);bm.transform(o.matrix_world)
        trees.append(BVHTree.FromBMesh(bm,epsilon=.0001));bm.free()
        points=[o.matrix_world @ Vector(v) for v in o.bound_box]
        bounds.append(([min(v[i] for v in points) for i in range(3)],[max(v[i] for v in points) for i in range(3)]))
    assert abs(min(b[0][2] for b in bounds))<.00001, f'{source.stem}: floor mismatch'
    stack='stack' in source.stem
    height=1.9 if stack else .85
    assert abs(max(b[1][2] for b in bounds)-height)<.00001, f'{source.stem}: height mismatch'
    feet=[i for i,o in enumerate(objects) if o.name.startswith('Adjustable appliance floor foot')]
    assert len(feet)==8
    assert len([i for i in feet if abs(bounds[i][0][2])<.00001])==(4 if stack else 8)
    links={i:set() for i in range(len(objects))}
    for i in links:
        for j in range(i):
            if any(bounds[i][0][ax]>bounds[j][1][ax]+.0001 or bounds[j][0][ax]>bounds[i][1][ax]+.0001 for ax in range(3)):continue
            if trees[i].overlap(trees[j]):links[i].add(j);links[j].add(i)
    unseen=set(links);groups=[]
    while unseen:
        found=set();pending=[next(iter(unseen))]
        while pending:
            i=pending.pop()
            if i in found:continue
            found.add(i);pending.extend(links[i]-found)
        unseen-=found;groups.append(found)
    assert len(groups)==(1 if stack else 2), f'{source.stem}: disconnected groups: {[[objects[i].name for i in g] for g in groups]}'
    for component in {o['component'] for o in objects}:
        matching=[g for g in groups if any(objects[i]['component']==component for i in g)]
        assert len(matching)==1, f'{source.stem}: disconnected {component}: {[[objects[i].name for i in g if objects[i]["component"]==component] for g in matching]}'
    for group in groups:
        mounted=all(objects[i].get('wallMounted') for i in group)
        assert mounted or min(bounds[i][0][2] for i in group)<.00001, f'{source.stem}: floating assembly'
    for i,o in enumerate(objects):
        if o.name.startswith('Concave smoked door glass'):
            assert 0<o.data.materials[0].node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value<.4
        if o.name.startswith('Laundry inner drum'):
            lo,hi=bounds[i];origin=Vector(((lo[0]+hi[0])/2,hi[1]+.2,(lo[2]+hi[2])/2))
            hit=trees[i].ray_cast(origin,Vector((0,-1,0)))[0]
            assert hit and hit.y<hi[1]-.1, f'{source.stem}: drum opening is capped shut'
    print('LAUNDRY_CHECK',source.stem,len(objects),'parts',len(groups),'mounted or supported groups',flush=True)
