"""Verify modular kitchen joints and floor plinths.

blender --background --python-exit-code 1 --python apps/editor/scripts/check-kitchen-joints.py
"""
import bpy
import bmesh
import json
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from pathlib import Path

root=Path(__file__).resolve().parents[3]
for model in ('counter-straight-detailed','counter-corner-detailed','counter-double-sink'):
    bpy.ops.wm.open_mainfile(filepath=str(root/'assets/kitchen'/f'{model}.blend'))
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    floor_parts=[o for o in objects if o.name.startswith(('Continuous cabinet floor plinth',))]
    expected=2 if model=='counter-straight-detailed' else 3 if model=='counter-double-sink' else 5
    assert len(floor_parts)==expected, f'{model}: incorrect floor supports'
    for o in floor_parts:
        bottom=min((o.matrix_world @ Vector(v)).z for v in o.bound_box)
        assert abs(bottom)<.00001, f'{model}: {o.name} does not touch the floor ({bottom})'
    trees=[]
    for o in objects:
        bm=bmesh.new();bm.from_mesh(o.data);bm.transform(o.matrix_world)
        trees.append(BVHTree.FromBMesh(bm,epsilon=.0001));bm.free()
    links={i:set() for i in range(len(objects))}
    for i in links:
        for j in range(i):
            if trees[i].overlap(trees[j]):links[i].add(j);links[j].add(i)
    unseen=set(links);groups=[]
    while unseen:
        found=set();pending=[next(iter(unseen))]
        while pending:
            i=pending.pop()
            if i in found:continue
            found.add(i);pending.extend(links[i]-found)
        unseen-=found;groups.append({objects[i].name for i in found})
    print('JOINT_CHECK',model,json.dumps([sorted(g) for g in groups]),flush=True)
    by_name={o.name:o.get('component') for o in objects}
    for component in set(by_name.values()):
        assert component is not None, 'Every kitchen part must have a structural owner'
        matching=[g for g in groups if any(by_name[n]==component for n in g)]
        assert len(matching)==1, f'{model}: disconnected parts in {component}'
    if model=='counter-double-sink':
        for x in (-.181,.181):
            hits=[hit[0].z for tree in trees if (hit:=tree.ray_cast(Vector((x,.020,1.1)),Vector((0,0,-1))))[0] is not None]
            assert hits and .70<max(hits)<.78, f'Sink opening is blocked at {x}: {hits}'
