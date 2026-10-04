"""Check that every part of the newer assemblies is joined and the whole stands on the floor."""
import bpy
import bmesh
import sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from pathlib import Path

root=Path(__file__).resolve().parents[3]
groups=['decor','gym','utility','cars']
sources=[p for g in groups for p in sorted((root/'assets'/g).glob('*.blend'))]
sources+=[root/'assets/living-storage'/f'{n}.blend' for n in ('coffee-table-round-oak','side-table-square-oak')]
sources+=[root/'assets/bedroom-dining'/f'bed-upholstered-{n}.blend' for n in ('full','queen','king','cal-king')]
sources+=[root/'assets/seating'/'armchair-compact.blend']
failed=[]
for source in sources:
    bpy.ops.wm.open_mainfile(filepath=str(source))
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name!='Plane']
    trees=[];bounds=[]
    for o in objects:
        bm=bmesh.new();bm.from_mesh(o.data);bm.transform(o.matrix_world)
        trees.append(BVHTree.FromBMesh(bm,epsilon=.0002));bm.free()
        points=[o.matrix_world @ Vector(v) for v in o.bound_box]
        bounds.append(([min(v[i] for v in points) for i in range(3)],[max(v[i] for v in points) for i in range(3)]))
    links={i:set() for i in range(len(objects))}
    for i in links:
        for j in range(i):
            if any(bounds[i][0][ax]>bounds[j][1][ax]+.0005 or bounds[j][0][ax]>bounds[i][1][ax]+.0005 for ax in range(3)):continue
            if trees[i].overlap(trees[j]):links[i].add(j);links[j].add(i)
    unseen=set(links);found_groups=[]
    while unseen:
        found=set();pending=[next(iter(unseen))]
        while pending:
            i=pending.pop()
            if i in found:continue
            found.add(i);pending.extend(links[i]-found)
        unseen-=found;found_groups.append(found)
    floor=min(b[0][2] for b in bounds)
    problems=[]
    if abs(floor)>.015:problems.append(f'floor at {floor:.4f}')
    if len(found_groups)>1:
        main=max(found_groups,key=len)
        problems.append('loose: '+', '.join(sorted({objects[i].name for g in found_groups if g is not main for i in g})))
    print('ASSEMBLY',source.stem,len(objects),'parts','OK' if not problems else '; '.join(problems),flush=True)
    if problems:failed.append(source.stem)
if failed:
    print('ASSEMBLY FAILED',failed,flush=True);sys.exit(1)
