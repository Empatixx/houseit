"""Verify office structural contact and floor supports.

blender --background --python-exit-code 1 --python apps/editor/scripts/check-office-joints.py
"""
import bpy
import bmesh
import json
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from pathlib import Path

root=Path(__file__).resolve().parents[3]
for model in ('desk-oak-steel','desk-corner-oak','filing-three-drawer'):
    bpy.ops.wm.open_mainfile(filepath=str(root/'assets/office'/f'{model}.blend'))
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    floor_parts=[o for o in objects if o.name.startswith(('Desk floor pad','Continuous recessed cabinet plinth'))]
    expected=1 if model=='filing-three-drawer' else 4
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
    assert len(groups)==1, f'{model}: disconnected construction parts'
