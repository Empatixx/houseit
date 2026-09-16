"""Check bar construction, floor supports and the unobstructed sink bowl."""
import bpy
import bmesh
import json
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from pathlib import Path

root=Path(__file__).resolve().parents[3]
sources=sorted((root/'assets/kitchen-bars').glob('*.blend'))
assert len(sources)==2, 'Both bar assemblies must be generated'
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
    assert abs(max(b[1][2] for b in bounds)-1.6)<.001, f'{source.stem}: height mismatch'
    island='serving-island' in source.stem
    count=3 if island else 0
    assert len([o for o in objects if o.name.startswith('Stool floor glide')])==count*4
    assert len([o for o in objects if o.name.startswith('Serving island floor glide')])==(4 if island else 0)
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
    assert len(groups)==count+1+int(island), f'{source.stem}: disconnected groups: {[[objects[i].name for i in g] for g in groups]}'
    for component in {o['component'] for o in objects}:
        matching=[g for g in groups if any(objects[i]['component']==component for i in g)]
        assert len(matching)==1, f'{source.stem}: disconnected {component}: {[[objects[i].name for i in g if objects[i]["component"]==component] for g in matching]}'
    for group in groups:
        mounted=all(objects[i].get('wallMounted') for i in group)
        assert mounted or min(bounds[i][0][2] for i in group)<.00001, f'{source.stem}: floating assembly'
    for i,o in enumerate(objects):
        if o.name.startswith(('Stool floor glide','Serving island floor glide','Continuous cabinet floor plinth')):
            assert abs(bounds[i][0][2])<.00001, f'{source.stem}: hovering support {o.name}'
        if o.name.startswith('Rounded stainless bowl and rim'):
            centre=Vector([(bounds[i][0][ax]+bounds[i][1][ax])/2 for ax in range(3)])
            origin=Vector((centre.x,centre.y,1.1))
            hits=[hit[0].z for tree in trees if (hit:=tree.ray_cast(origin,Vector((0,0,-1))))[0] is not None]
            assert hits and .70<max(hits)<.78, f'{source.stem}: blocked sink: {hits}'
    print('BAR_CHECK',source.stem,len(objects),'parts',len(groups),'mounted or supported groups',flush=True)
