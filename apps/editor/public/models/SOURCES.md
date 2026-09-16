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
and nonmetallic upholstery keep highlights subtle. The wooden chair retains the shared neutral grain when the editor applies
wood colours. Catalog dimensions control placed objects, preserving existing plans.

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


## Original console, coat stand and clothes rack

Approved visual references are recorded in `docs/plans/hallway-reference-selection.json`.
All meshes and timber textures are generated from original Blender source.

| File | Catalogue type | Construction |
| --- | --- | --- |
| console-rounded-mirror.glb | console-mirror | Continuous rounded timber shell, three drawers, attached pulls, splayed legs and separate wall-mounted round mirror |
| coat-stand-curved.glb | coat-stand | Continuous curved hooks, four swept legs, connected circular brace and floor glides |
| clothing-rack-arched.glb | clothing-rack | Two continuous arched frames, hanging bar, solid bag shelf and lower rod shelf |

Generate with `node apps/editor/scripts/make-hallway.mjs`; append model names to
rebuild selected pieces. Blender 4.5 is required; `BLENDER_PATH` is supported.
Editable source parts and studio renders are saved in `assets/hallway/`.
Run `blender --background --python-exit-code 1 --python apps/editor/scripts/check-hallway-joints.py`
to verify joints and all four floor supports on each model. The console and its
wall-mounted mirror intentionally form two separate connected groups.

The console timber and both stands' powder coat use the editable `body` material.
Mirror glass/frame and floor glides retain their own finishes. The mirror uses a
simple silver material; it does not introduce a live reflection render pass.
Existing catalogue footprints and SVG symbols are unchanged. Console height is
1800 mm including the mirror; the tabletop remains approximately 850 mm high.


## Shared subtle wood grain

`apps/editor/scripts/wood-grain.py` generates a seamless, low-contrast neutral
256 px tile from irregular elongated noise. It replaces the earlier repeated
sine bands on the console, dining tables, TV cabinet, nightstand, dresser and
sideboard. The original dining chair now embeds the same neutral tile and sets
`houseitTexture: "tint"`, so choosing oak/walnut does not replace it with a floor
plank texture. Timber remains recolourable, while the sideboard retains a fixed
pale oak variation. Geometry and catalogue footprints are unchanged by this
material refresh. The bedroom/dining generator also accepts individual model
names, like the other Blender wrappers.


## Original chaise, wingback and fitted shelving

Approved references are in `docs/plans/lounge-reference-selection.json`. Geometry,
textile patterns and construction are generated from original Blender source.

| File | Catalogue type | Construction |
| --- | --- | --- |
| chaise-soft.glb | lounge-chair | Recessed feet, upholstered base, long boxed cushion and separate back cushion |
| wingback-with-ottoman.glb | chair-ottoman | Smooth padded wings/arms, sculpted button depressions, separate sewn seat and matching ottoman |
| shelving-fitted.glb | built-in-shelf | Fitted trim, open shelves with rear upstands, recessed-panel lower doors and connected knobs |

Generate with `node apps/editor/scripts/make-lounge.mjs`; optional model names
limit regeneration. Blender 4.5 is required; `BLENDER_PATH` is supported. Editable
parts and previews are saved in `assets/lounge/`. Upholstery and painted shelving
use the editable `body` material; feet and door knobs retain separate finishes.

Run `blender --background --python-exit-code 1 --python apps/editor/scripts/check-lounge-joints.py`
to verify structural contacts and floor supports. Chair and ottoman intentionally
form two connected groups. Thin sewn seams are excluded from structural checks.

Original catalogue footprints and SVG plan symbols are preserved. The wingback
set height is 1100 mm including its back, replacing the former seat-only height.

## Original office furniture

- `desk-oak-steel.glb` → `office-desk`: softly rounded oak top, rear cable access strip, white telescoping T legs, adjustable floor pads, connected felt cable tray and under-desk hooks. Visual reference: [MITTZON](https://www.ikea.com/cz/cs/p/mittzon-psaci-stul-dyha-dub-bila-s19529124/).
- `desk-corner-oak.glb` → `office-desk-l`: continuous rounded top with a short return, two white round uprights, connected underside rails and cable tray. The return stays on the side of the original catalogue symbol and generator. Visual reference: [BEKANT](https://www.ikea.com.tr/en/product/bekant-white-white-stained-oak-veneer-160x110-cm-corner-desk-left-19282839).
- `filing-three-drawer.glb` → `filing-cabinet`: painted carcass, three separate drawer fronts with actual recessed finger grips, internal floors/runners, recessed floor plinth and small combination lock. Visual reference: [GALANT](https://www.ikea.com/gb/en/p/galant-file-cabinet-white-80365185/).

All meshes are original Houseit Blender geometry. No external meshes or product textures are included. References were approved by the user. Editable sources and studio previews: `assets/office/`. Build with `node apps/editor/scripts/make-office.mjs`; optional model-name arguments rebuild individual models. `check-office-joints.py` verifies each model is one connected construction group and all designated supports touch the floor. Desks reuse the shared subtle neutral wood texture and recolourable `body`; metal legs remain white. The cabinet uses a recolourable painted `body`. Existing heights and detailed 2D symbols are retained. The corner desk was corrected following user feedback to the reference proportions: new defaults are 1600 × 1100 mm, and its original detailed SVG and collision footprint were adjusted to match the shorter return. Saved object dimensions are not rewritten.

## Original kitchen appliances

- `fridge-freezer-classic.glb` → `refrigerator`: separate rounded fridge/freezer doors, actual inset grips, seals, hidden hinges, rear compressor cover and four adjustable feet. Reference: [LAGAN fridge-freezer](https://www.ikea.com/cz/cs/p/lagan-lednice-s-mraznickou-samostatne-stojici-bila-00571293/).
- `dishwasher-classic.glb` → `dishwasher`: flush door, recessed horizontal grip, control fascia, small buttons/indicators, removable top and floor feet. Reference: [LAGAN freestanding dishwasher](https://www.ikea.com/cz/cs/p/lagan-samostatne-stojici-mycka-bila-70576744/).
- `cooker-ceramic-classic.glb` → `stove`: original black freestanding cooker with four subtle induction-style zone rings, glass hob with touch controls, electronic oven fascia, restrained temperature display, rounded graphite handle, dark glass in a real door-frame opening and lower drawer. Redesigned to the user’s black-glass brief after the initial [LAGAN oven](https://www.ikea.com/cz/cs/p/lagan-trouba-bila-10600054/) inspiration; it is not a reproduction of that built-in product.

All three models are original Blender geometry with restrained roughness and recolourable enamel `body`. No manufacturer meshes, logos or photographs are embedded. Sources and previews are in `assets/appliances/`. Build with `node apps/editor/scripts/make-appliances.mjs`; check connected parts and four floor contacts using `check-appliances-joints.py`. Catalogue dimensions and heights remain unchanged. The cooker’s 2D symbol keeps its original outline and four zone positions, with soft charcoal glass, simple thin zone rings, diagonal white reflections and an off-white front control strip to keep black cookers legible. Other appliance symbols are unchanged. New cookers default to black; saved surface selections remain editable. Reference selection follows the user's updated autonomous workflow.

## Original kitchen counters and sink

- `counter-straight-detailed.glb` → `counter-straight`: flat-front cabinets, drawers, connected satin pulls, recessed plinth and continuous mineral worktop.
- `counter-corner-detailed.glb` → `counter-l`: the same construction follows the original L footprint and return orientation.
- `counter-double-sink.glb` → `kitchen-sink`: two rounded steel bowls in actual countertop openings, drain strainers, overflow details and arched mixer tap.

Original Blender geometry inspired by the references in `docs/plans/kitchen-counters-reference-selection.json`; no external meshes or textures are included. Build with `node apps/editor/scripts/make-kitchen.mjs`. Editable sources and renders are in `assets/kitchen/`. `check-kitchen-joints.py` verifies connected cabinet parts, floor plinths and raycasts through the real basin openings. Painted fronts remain recolourable; worktops and metal fixtures retain their own finishes. Original 2D symbols and footprints are unchanged. Countertops remain 900 mm high; the sink model’s total height is 1263 mm including its tap.

## Original fitted kitchen assemblies

The nine `kitchen-*-detailed.glb` files map to the corresponding `kitchen-*` catalogue IDs: compact/full straight and L kitchens, U kitchens, and four variants with wall cabinets. Reference: [ENHET kitchen](https://www.ikea.com/cz/cs/p/enhet-kuchyne-bila-vzor-dub-bila-s29337860/), recorded in `docs/plans/kitchen-sets-reference-selection.json`. All geometry is original Blender construction.

Generate with `node apps/editor/scripts/make-kitchen-sets.mjs`; optional model-name arguments limit regeneration. Editable sources and studio previews live in `assets/kitchen-sets/`. Assemblies reuse the detailed cabinet carcasses, drawers, pulls, real sink cutouts, mixer taps, refrigerator and black electronic cooker. Blind corner closures keep inaccessible corners free of handles; upper returns extend to meet the rear wall cabinets. Painted cabinet fronts are recolourable, while appliances, mineral worktops and hardware retain their own finishes.

Catalogue widths, depths and detailed SVG symbols remain unchanged. Worktops stay at 900 mm; assembly heights are 1800 mm including the refrigerator and 2150 mm for variants with wall cabinets. `check-kitchen-sets.py` verifies every part belongs to a connected construction component, every group is floor-supported or wall-mounted, eight appliance feet sit on the floor, and rays through every sink opening reach the basin floor.

## Original kitchen islands and round stools

- `island-two-detailed.glb` / `island-four-detailed.glb` → `island-2` / `island-4`: framed pale cabinets with open shelves and a thick recolourable timber worktop; two or four matching round stools.
- `island-two-sink-detailed.glb` / `island-four-sink-detailed.glb` → `island-2-sink` / `island-4-sink`: recolourable closed cabinet fronts, mineral worktop, two actual recessed steel bowls and mixer tap; two or four fixed pale timber stools.

References: [TORNVIKEN](https://www.ikea.com/cz/cs/p/tornviken-kuchynsky-ostruvek-kremova-dub-40391657/) and [DALFRED](https://www.ikea.com/gb/en/p/dalfred-bar-stool-birch-80613091/), listed in `docs/plans/kitchen-islands-reference-selection.json`. Geometry and the shared subtle wood grain are original; no manufacturer assets are included. Sources and previews: `assets/kitchen-islands/`; build with `node apps/editor/scripts/make-kitchen-islands.mjs`. `check-kitchen-islands.py` checks each stool and island is connected separately, all feet meet the floor and the sink opening reaches the basin. Existing plan symbols and catalogue footprints are retained. Worktops remain 900 mm; sink variants are 1263 mm overall including the faucet.
