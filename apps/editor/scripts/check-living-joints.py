"""Check structural contact in the generated living-room cabinets and hall bench.

blender --background --python-exit-code 1 --python apps/editor/scripts/check-living-joints.py
"""
import bpy, bmesh, json
from mathutils.bvhtree import BVHTree
from mathutils import Vector
from pathlib import Path
root=Path(__file__).resolve().parents[3]
for model in ('bookshelf-classic','sideboard-oak-white','bench-storage-cushioned'):
 bpy.ops.wm.open_mainfile(filepath=str(root/'assets/living-storage'/f'{model}.blend'))
 objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and 'stitched edge' not in o.name]
 for o in objects:
  if o.name.startswith(('Full-height bookcase side','Square oak foot','Continuous corner post')):
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
  unseen-=found;groups.append([objects[i].name for i in sorted(found)])
 print('JOINT_CHECK',model,json.dumps(groups),flush=True)
 assert len(groups)==1, f'{model}: disconnected construction parts'
