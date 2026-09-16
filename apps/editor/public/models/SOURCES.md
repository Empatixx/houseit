# Furniture models

## Original Blender furniture

The `*-classic*.glb` files are original Houseit geometry, modelled in Blender:
2-seat and 3-seat sofas, a chaise sofa, a curved upholstered armchair, an office
chair and a wooden dining chair. No Sketchfab geometry, textures or materials
are included. All textile patterns are generated from scratch.

Visual references supplied by the user:
- [Straight sofa](https://sketchfab.com/3d-models/sofa-80edec2de8c04a4fb335a48b550a2336)
- [Curved armchair](https://sketchfab.com/3d-models/sofa-chair-0e8e009f398249b9bc13e8ff7078530a)
- [Wooden chair](https://sketchfab.com/3d-models/wooden-chair-75258f5b06534b0fb64e16eb842e3f64)
- [KIVIK chaise proportions](https://www.ikea.com/cz/cs/p/kivik-3mistna-pohovka-s-lenoskou-tresund-antracit-s99482839/)

These are independently constructed interpretations, not official product assets
or exact replicas. Sofa cushions have inflated panels, compressed sewn edges,
side boxing, perimeter piping and small tension folds. Scatter pillows have
pinched edges and a fuller centre. The armchair has a curved, channelled shell.

Regenerate with `node apps/editor/scripts/make-seating.mjs` (Blender 4.5 required;
set `BLENDER_PATH` if it is not installed in the usual location).
To rebuild only the chairs, append `dining-chair-classic office-chair-classic`.
Their structural joints and caster orientation can be checked with
`blender --background --python-exit-code 1 --python apps/editor/scripts/check-chair-joints.py`.
The generator is `apps/editor/scripts/make-seating.py`. Named editable parts are
saved to `assets/seating/*.blend`; `sofa-preview.png` is the studio preview.
Runtime GLBs combine parts by material. Neutral embedded fabric maps preserve
recolouring through the `body` material; feet remain separate. High roughness
and nonmetallic upholstery keep highlights subtle. The wooden chair uses the editor's
wood finishes. Catalog dimensions control placed objects, preserving existing plans.

`assets/seating/sketchfab-sources.json` records the reference candidates checked;
none of those downloadable assets is bundled. Their licenses do not apply to
these original meshes.

## Original beds, dining tables and television

Six more original Blender models are generated with
`node apps/editor/scripts/make-bedroom-dining.mjs` (Blender 4.5):

| File | User-approved visual reference |
| --- | --- |
| bed-upholstered.glb | [Low upholstered headboard](https://sketchfab.com/3d-models/upholstered-bed-ae5e1a7c8b6b4cc3888acf28598bc894) |
| bed-channelled.glb | [Channelled headboard and footboard](https://sketchfab.com/3d-models/bed-with-upholstery-low-poly-dce5bc7bc4594e9aa1df1b379a54df4c) |
| table-rectangular.glb | [Wood top and steel sled legs](https://sketchfab.com/3d-models/sleek-modern-dining-table-set-9135349108174c8285433b3695977158) |
| table-round.glb | [Round wooden table](https://sketchfab.com/3d-models/wooden-dining-table-set-2095d18b9602473c8f717377fdffe017) |
| television-flat.glb | [Flat-screen TV with pedestal](https://sketchfab.com/3d-models/flatscreen-tv-46-inch-94c7ccaea76f4093b484828419db25cb) |
| tv-stand-wood.glb | [Wood and white TV cabinet](https://sketchfab.com/3d-models/tv-cabinets-andersen-a225d196dd7c4b50a140ecfc22bcb284) |

These are newly constructed interpretations. No geometry, maps, logos or screen
images from the reference assets are included. Editable `.blend` files and
individual studio renders are in `assets/bedroom-dining/`.

The shared cushion helpers are imported from `make-seating.py` without regenerating
seating. Bed duvets are continuous draped meshes with actual folds and hems.
Mattresses, ivory pillows, cabinet fronts, TV screens and metal legs retain their
own materials when the editable body is recoloured. Wood contains an original
neutral grain texture. Its `houseitTexture: "tint"` material property preserves
that map when applying oak/walnut colours, both live and in saved archives.

All six are individually available in the catalog. The standalone TV rests at
580 mm, matching the new cabinet. Existing double-bed types use the low-headboard
model, including its full 1120 mm height; existing dining sets and combined TV
units use the new models while retaining their plan dimensions and symbols.

## Downloaded tables and dining chairs

These models are by Poly Haven contributors and distributed under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
See [Poly Haven's asset license](https://polyhaven.com/license).

| Local file | Original |
| --- | --- |
| coffee-table.glb | [Coffee Table Round 01](https://polyhaven.com/a/coffee_table_round_01) |
| side-table.glb | [Side Table 01](https://polyhaven.com/a/side_table_01) |
| dining-table.glb | [Dining Table](https://polyhaven.com/a/dining_table) |
| dining-chair.glb | [Dining Chair 02](https://polyhaven.com/a/dining_chair_02) |

Regenerate with `node scripts/get-furniture-models.mjs` from the repository root.
The download manifest pins source URLs and checksums. The script embeds the 1K
textures in GLB, orients seating toward local -Z, turns the dining table's long
axis along Z, omits the tablecloth, and names editable materials `body`.
No runtime connection to Poly Haven is required. Geometry, UVs and normals are
preserved. Existing catalog dimensions, footprints and 2D symbols are unchanged.

The pre-existing `bathtub.glb` comes from the
[Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit), also CC0,
and is rebuilt separately with `node scripts/get-models.mjs`.
The old `wardrobe.glb` is retained as an unused historical asset; the catalogue now uses `wardrobe-classic.glb`.


## Original bedroom storage, single bed and cot

Five approved references are recorded in `docs/plans/bedroom-reference-selection.json`.
They inform the design of original Houseit meshes; no downloaded geometry, textures,
logos or branded markings are included.

| File | Catalogue type | Construction |
| --- | --- | --- |
| nightstand-rounded.glb | nightstand | Rounded continuous timber side frames, recessed drawer pull and lower slatted shelf |
| dresser-three-drawer.glb | dresser | Three full-width drawers, sloping recessed top pulls and inset plinth |
| wardrobe-classic.glb | wardrobe | Two doors, three lower drawers on the viewer's right, satin dark U handles |
| bed-single-upholstered.glb | twin-bed | Channelled upholstered headboard, full-sized soft pillows and draped duvet |
| crib-rounded.glb | crib | Rounded painted ends, connected beech spindles and rails, mattress and tapered feet |

Generate all five with `node apps/editor/scripts/make-bedroom-storage.mjs`, or append
one or more model names to rebuild selected pieces. Blender 4.5 is required; the
wrapper respects `BLENDER_PATH`. Editable parts and studio renders are saved in
`assets/bedroom-storage/`. Shared geometry/material helpers are imported without
regenerating the existing furniture.

Run `blender --background --python-exit-code 1 --python apps/editor/scripts/check-bedroom-joints.py`
to verify that all cabinet/cot construction pieces belong to one contact graph.

The `body` material remains editable. Timber retains its neutral original grain,
painted panels take a plain tint, and beech rails, handles, mattress and sleeping
pillows retain separate finishes. Existing object IDs, 2D symbols and plan dimensions
are preserved. The single bed's height is 1050 mm to include the headboard.


## Original living-room and hallway storage

Three user-approved references are recorded in `docs/plans/living-reference-selection.json`.
The meshes, UVs, timber grain and upholstery patterns are generated from our own
Blender source; reference meshes, textures and branding are not included.

| File | Catalogue type | Construction |
| --- | --- | --- |
| bookshelf-classic.glb | bookshelf | Six open compartments, thin shelves, recessed backing and plinth |
| sideboard-oak-white.glb | credenza | Pale oak carcass, two full-height doors, two central drawers and eight supporting feet |
| bench-storage-cushioned.glb | bench | Painted storage frame, wide inset drawer, two connected knobs, sewn seat pad and two loose cushions |

Generate with `node apps/editor/scripts/make-living-storage.mjs`; append model names
for a partial rebuild. The wrapper uses Blender 4.5 and supports `BLENDER_PATH`.
Editable source parts and studio previews are saved in `assets/living-storage/`.
Run `blender --background --python-exit-code 1 --python apps/editor/scripts/check-living-joints.py`
to check structural contact (including cushions) and every floor support.

Recolouring affects the bookcase panels, sideboard fronts and bench upholstery.
The sideboard keeps its original pale oak grain, and the bench keeps its painted
frame and dark knobs. Original catalogue footprints and SVG plan symbols are
preserved. Bench height is 650 mm including the loose cushions; the seat remains
approximately 450 mm above the floor.
