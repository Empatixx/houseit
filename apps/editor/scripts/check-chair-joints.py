"""Check actual timber/metal intersections and caster axes in the editable sources.

blender --background --python-exit-code 1 --python apps/editor/scripts/check-chair-joints.py
Seams are separate decorative meshes; the structural pieces must form one contact graph.
"""
import bpy, bmesh, json
from mathutils.bvhtree import BVHTree
from pathlib import Path
root=Path(__file__).resolve().parents[3]
for model in ('dining-chair-classic','office-chair-classic'):
 bpy.ops.wm.open_mainfile(filepath=str(root/'assets/seating'/f'{model}.blend'))
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

 # All wheel axles are horizontal and transverse to their five-star base spoke.
 for obj in objects:
  if not obj.name.startswith('Caster wheel'):continue
  axis=obj.matrix_world.to_3x3().col[2].normalized()
  radial=obj.location.copy();radial.z=0;radial.normalize()
  assert abs(axis.z)<1e-5, f'{obj.name}: tilted wheel axle'
  assert abs(axis.dot(radial))<.08, f'{obj.name}: wheel does not follow its base spoke'
  bottom=min((obj.matrix_world @ vertex.co).z for vertex in obj.data.vertices)
  assert abs(bottom)<.001, f'{obj.name}: wheel does not touch the ground'
