"""Check structural contact in the generated bedroom cabinets and cot.

blender --background --python-exit-code 1 --python apps/editor/scripts/check-bedroom-joints.py
"""
import bpy, bmesh, json
from mathutils.bvhtree import BVHTree
from pathlib import Path
root=Path(__file__).resolve().parents[3]
for model in ('nightstand-rounded','dresser-three-drawer','wardrobe-classic','crib-rounded'):
 bpy.ops.wm.open_mainfile(filepath=str(root/'assets/bedroom-storage'/f'{model}.blend'))
 objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and 'stitched edge' not in o.name]
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
  unseen-=found;groups.append([objects[i].name for i in sorted(found)])
 print('JOINT_CHECK',model,json.dumps(groups),flush=True)
 assert len(groups)==1, f'{model}: disconnected construction parts'

