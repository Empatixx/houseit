"""Verify structural contact, floor supports, and the intentional wall mirror group.

blender --background --python-exit-code 1 --python apps/editor/scripts/check-hallway-joints.py
"""
import bpy
import bmesh
import json
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from pathlib import Path

root=Path(__file__).resolve().parents[3]
for model in ('console-rounded-mirror','coat-stand-curved','clothing-rack-arched'):
    bpy.ops.wm.open_mainfile(filepath=str(root/'assets/hallway'/f'{model}.blend'))
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    floor_parts=[o for o in objects if o.name.startswith(('Splayed console foot','Coat stand floor glide','Rack adjustable floor glide'))]
    assert len(floor_parts)==4, f'{model}: expected four floor supports'
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
    if model=='console-rounded-mirror':
        assert len(groups)==2, 'Console and wall mirror must each form one connected group'
        assert {'Wall mirror glass','Thin round mirror frame'} in groups, 'Only the wall mirror may be separate'
    else:
        assert len(groups)==1, f'{model}: disconnected construction parts'
