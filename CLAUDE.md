# Working on houseit

## Everything goes through the CLI, and that is the test

An agent gets at this plan through one door: the commands in `packages/commands`,
reached over MCP. The dwelling commands are `add`, `update` and `remove` for a level,
a room, an opening and an object, and `get-plan`; building commands add columns, shafts and ramps. Every change is made the
way an agent would have to make it, never by writing to the document. If
something cannot be said as a command, that is the bug, and it is the bug to fix.

The wall authoring model on `that-open-engine`:

- **Walls are independent elements.** `add-wall`, `update-wall` and `remove-wall`
  operate on a stable element id. Junctions may split its topology into segments;
  readback lists both the element and those segments. Rooms derive from closed
  spaces. `add-room --at` names and finishes an existing space without adding
  walls; the shape forms of `add-room` still create an entire room.
- **One edit path.** Wall drawing, drag preview, drag commit and Delete use the
  same typed commands as CLI/MCP. Native wall solids and opening subtraction run
  in the That Open GeometryEngine worker. `FragmentAuthoring` commits typed commands
  and CLI scripts into the public That Open `SingleThreadedFragmentsModel`: native items,
  relations and request history own the authoring state; the store document is its read projection.
  Domain commands compile wall constraints, room derivation and host behavior that That Open
  does not provide. Undo/redo selects native request boundaries, not Immer patches.
  Fragment archives serialize a captured revision of that same native model, retaining its
  local IDs and relationships. The writer compacts native item/relation requests against the
  base buffer and derives wall shells with GeometryEngine; it owns no second editable model
  or Fragment worker pool. Do not call native save on the live history: it appends a request.
  Metadata contains only the authoring schema marker. Schema 3 stores columns, roofs, ramps, shafts, measured stairs and terrain parts as independent native items, with ordered HasParts collections, ContainedIn, ConnectsTo and MappedTo relations. Level/project parameters no longer duplicate those records. HouseDocument reconstructs their nested command projection from native relations. Roof IDs survive reorder/rename and are supplied in readback; legacy JSON replacements match an unambiguous prior roof or allocate a new ID. Schemas 1/2 upgrade without changing existing native IDs. Archives load directly into authoring
  without rebuilding entities from a HouseDocument; schema-one metadata is upgraded on load. CLI/MCP waits for native persistence before
  returning success. Keep MCP tool title, description and schema stable. The React presentation adapter supplies the established
  plan symbols, finishes, gestures and walkthrough; the native viewport replacement
  in `eb29400` was withdrawn because it regressed those features.
  Native measurements, snapping, ID selection and cut views now use a public That Open
  World adapter over the shared presentation scene/camera/renderer. Tools query the displayed
  Fragments directly; there is no separate interaction model or scene-to-geometry copying. Walls, floors, slabs, furniture, opening fills, 3D stairs, ramps, shaft parts, roofs, columns, facades and exterior site geometry render as native Fragments shells in each viewport's
  `FragmentDisplay`, using the same FragmentsManager as its tools. The native editor owns
  batching and delta models; HouseitKey maps display items to their domain owners; a room can own several floor/slab items.
  These per-camera models are derived presentation, never a second authoring/history authority.
  Do not create invisible interaction copies. Tile IDs go through the public native
  local-ID mapper; the wall appearance adapter retains the established per-side materials,
  UV scale and React gestures on the actual native triangles. CPU tile attributes remain
  available for those gestures via public BufferAttribute upload callbacks. A native delta
  and its parent may both occur in Highlighter selection: compare domain owners, not raw
  alias count. Display tiles stay in ALL_VISIBLE mode so thumbnails can use a separate camera
  without silently dropping walls outside the live camera. Canvas readiness includes native
  surface updates; CLI pictures and project thumbnails wait for completion. View/clip collections own their disposal. Keep UI gestures
  and layout stable when replacing engine internals. Floor coverings and structural slabs carry
  explicit scene roles; keep their existing well/recess/exposed-top derivation. The shared tile
  adapter restores metric flat UVs and separate cap/edge finishes. Distinct opaque neutral native
  materials keep shadow-casting walls and non-casting slabs in separate native batches; actual
  presentation materials still come from the existing caches.
  Furniture symbols and 3D pieces use the same NativeSurface path; repeated immutable geometry keys
  share native representations, while samples keep independent transforms and owners. A resize must
  detach only the changed sample, and unused representations are removed only after their final use.
  Preserve source triangulation through public GeometryProcessSettings (threshold 0) for furniture;
  tile appearance restores source UVs, smooth normals and material groups without replacing native
  positions/indices. Keep shadow settings separate in native batches. Transparent surfaces have their
  own batches and retain a single material where possible so postprocessing detects transparency.
  Brought normalizes static GLB assets once per size, bakes their hierarchy into source buffers and
  disposes only its generated geometry/paint materials. The catalogue, SVGs, procedural builders,
  footprints, stacking and domain commands remain shared Houseit presentation/business rules.
  Opening frames, leaves, handles and glazing use that same path in 3D; plan opening boxes and
  swing marks use NativeSurface too. Preserve explicit parent opening IDs for assembly panels and
  paired leaves, and give every derived piece a stable, distinct name. Never select a synthetic
  panel/leaf ID. Transparent doorway hit areas remain UI helpers so an empty passage can still be
  dragged; they are UI hit targets, not native measurement geometry.
  Start the local opening preview only after pointer movement, so an ordinary click does not hide
  its own hit target.
  Catalogue stairs and measured `add-stair` flights/landings carry the explicit `stair-solid` role
  and render as IFCSTAIR items through that same shared NativeSurface path. Preserve source
  triangulation/UVs for their prisms too. Keep `treadsOf`, storey rise, base offset, thickness,
  wells and walking rules shared; this is a display migration, not a new staircase authoring model.
  Catalogue parts retain their object owner; measured runs retain their existing unowned presentation.
  Current-floor catalogue glyphs are already native. The measured 2D flight annotations and
  translucent stairs-below plan overlay remain UI presentation; do not claim those are IFCSTAIR items.
  `native-stair-proof.mjs` covers all five catalogue shapes, repeated instances and `--measured`
  covers the basement's three flights and irregular landings. Run `live-furniture-preview-proof.mjs
  --stairs` for real staircase dragging/rotation and native snapping during the preview.
  Ramp solids and shaft guides/enclosures use the same path with `ramp-solid`/`shaft-solid`
  roles and IFCRAMP/IFCBUILDINGELEMENTPROXY categories. House maps every scene role through one
  exhaustive category table. Preserve both sloping faces of ramp prisms through source-triangle
  mapping, and keep exposed-box trimming where enclosures meet columns. Equal guide geometry
  shares native representations. These pieces retain their existing unowned UI semantics; their
  actual 3D geometry is now available to native snapping/sections without inventing selection IDs.
  Their former unowned meshes were not copied by InteractionModel. The 2D ramp arrow/percentage
  and shaft plan marks remain schematic UI presentation. `native-connection-proof.mjs` covers
  all ramp directions, site elevations/base offsets, enclosed lifts and shafts around columns,
  including native/source geometry, edge snapping, cuts, actual keyboard walking and archives.
  Roof prisms/facets, parapets, coping and drains carry `roof-solid`/IFCROOF and use the same
  source-triangle mapping, preserving existing finishes and slopes. Roof shaping, validation,
  shaft voids and index-based piece names remain shared Houseit rules; roof parts retain their
  unowned UI semantics. Register and release NativeSurface in layout effects together: a passive
  old-component cleanup can otherwise remove its replacement under the same ID after a body-type
  change. `native-roof-proof.mjs` covers reordered/deleted roofs, mixed materials and noncoplanar
  facets; `--shaft` covers a roof opening and its removal/restoration. Facet roofs still have the
  existing limitation that they do not subtract shaft voids; this migration does not change it.
  Structural columns carry `column-solid`/IFCCOLUMN through that same path, including exposed-box
  skins where they meet walls and shaft enclosures. Their height still follows the storey soffit;
  embedded/outside permissions, occupied-floor derivation and walking collisions remain domain rules.
  Columns retain their existing unowned 3D semantics and dark schematic plan marks; no new selection
  or editing controls are introduced. `native-column-proof.mjs` covers repeated geometry, resize
  detachment, embedded-to-free movement, exterior/upper supports, native cuts/snapping, collision
  walking and archives; `--shaft` exercises the shared skin at enclosures around columns.
  Exterior coats carry `facade-covering`/IFCCOVERING and keep their wall owner and existing piece
  names. The shared source mapping preserves exposed-box skins at corners, colour bands, plinths
  and openings. Keep facade height through slab/buildup and the summed layer thickness in the shared
  scene generator; the engine does not supply those building rules. Native facade IDs resolve
  to the host wall for selection; walk mode
  keeps its existing non-picking behavior, while section views support facade clicks. The exterior
  schema currently describes colours and layer thicknesses, not named texture finishes; this display
  migration does not extend CLI schemas. Textured interior wall finishes already use native walls.
  `native-facade-proof.mjs` covers plinths, bounded bands, openings and persistence; `--continuity`
  covers multi-storey coats, corners and embedded columns. `live-wall-preview-proof.mjs --facade`
  verifies the coat after actual wall dragging and a single undo.
  3D site surfaces/markings/railings carry `site-surface`/`site-marking`/`site-railing`, mapped to
  IFCGEOGRAPHICELEMENT/IFCSURFACEFEATURE/IFCRAILING. Use absolute site elevations, including both
  sloped prism faces, and preserve named textures, road marking offsets, rail member rotations and
  transparent glass. The 400 m contextual lawn also uses NativeSurface, preserving its seeded
  texture, vertex colours and excavation holes. The shared source appearance mapper restores RGB
  vertex colours where present and uses neutral white for other geometry in the same tile. Never
  replace native positions/indices to restore appearance. Ground geometry is keyed by excavations,
  so unrelated document edits do not rebuild the lawn; dispose its geometry, texture and material.
  Site parts retain their unowned UI semantics. Datum-plan surface fills, constant-screen-width
  rail/marking lines, parking labels and the camera-following sky remain presentation. Do not claim
  an InteractionModel reduction for previously unowned site/ground meshes. `native-site-proof.mjs`
  covers textures, rails, source/vertex colours, empty lawn, native tools, edits and archives;
  `--ramp` covers basement/ramp excavation holes. Run the existing connection proof with
  `--fixture=site-ramp` for actual collision-enabled ramp traversal with the terrain visible.
  StandingPiece, PieceMesh, imported assets and symbol plates require a native identity; there is
  no ordinary building-mesh fallback. Keep source buffers/materials for appearance mapping. Lights, sky, hit targets, handles and schematic plan annotations remain presentation.
  NativeTools refreshes on document/storey, native display revision or view-setting changes, not
  periodic scene scans. Keep a pending refresh until geometry and pointer gestures settle; do not
  drop a request just because a native update or drag is currently running. The display owns model
  insertion, tile preparation and cameras; tools do not insert a second model into the scene.
  Browser proofs assert that every loaded model belongs to the display (including native deltas),
  not merely that an invisible model contains no owned items. The presentation proof also checks
  idle tools perform no refresh while preserving measurement, snapping, cuts and camera switching.
  Live construction previews, including drawn wall solids, use native Editor edits and visible
  Fragments tiles throughout the gesture. Do not restore source-mesh portals or hide native roots.
  Keep the public worker pool resident (one default worker, a lazy reserved background slot),
  and use zero update delay only while interacting; idle loaded models use 32 ms. Serialize native
  snapping with edits/tile preparation, query both the base and delta, and exclude the carried owner.
  Native selection aliases also cover both models. Appearance groups must preserve the native
  visibility ranges, including a matching drawRange when using a single material for transparency.
  After 250 ms without edits or pointer-down, compact only the derived display. Fragments 3.4.7
  corrupts shell offsets when deleting representations in deltas, or in a full save containing
  both newly created and retired shells. Defer resource deletion and rebuild a fresh native buffer
  from public EditUtils maps with CREATE-only requests, keeping IDs, materials and transforms.
  Keep the previous native root visible until the new tiles are prepared, then dispose old deltas.
  Never compact authoring history this way. The display-edits regression covers several replacements
  in one gesture, resource cleanup and another gesture after compaction. Live proofs measure
  actual rendered native triangle ranges, not preview metadata or source-buffer transforms.
  Publish pointer movement before awaiting asynchronous native snapping; stale snap results must
  not overwrite a newer pointer position. Check the
  installed That Open API and official documentation before adding custom tooling;
  extend native components only for Houseit domain behavior they do not provide. Record each logical change and remaining limits
  in `changelog.md`.
- **Room circles edit room boundaries.** A selected room handle uses `update-room --wall <segment> --by <mm>` to move just that segment and create a return where needed. Direct independent-wall dragging uses `update-wall` for the full element. Preview and commit use the same typed command; retain selection and native undo.
- **No verb for looking.** Every command answers with what it touched, those rooms
  read back in full — each wall with what opens and stands on it and the stretches
  still free — and everything now wrong with the plan. `describe`, `measure` and
  `check-plan` are gone as commands and live in `survey.ts`, `answer.ts` and
  `checks.ts`, which the answer is built from. `get-plan` is only for rooms a
  command did not touch.
- **`update` takes an id.** Every answer names what it changed, so the id of the
  sofa just placed is in the answer to placing it. There is no second way of saying
  which sofa, and so no way for the two to disagree. An id is one thing in the
  whole house, so it carries its storey with it and `--level` is never needed
  with one.
- **A room is looked for on every storey.** `--room ložnice` finds the bedroom
  wherever it is; `--level` said is `--level` meant. Which floor a room is on is
  something the plan knows and the person asking should not have to.

Working this way is not ceremony, it is the test. Everything found by hand so far
was found by driving the real commands and looking at what came out:

- a doorway drawn as a white slab, because the floors were never asked to meet in it
- a floor laid in a room that had none coming out black until the page reloaded
- a window left at a size no window is ever built at
- a picture that was a sliver of plan, because the panel had been asked to fold
  and the folding had not happened yet when the clear region was read

None of it shows up in a unit test, and none of it would have been noticed by
editing the document behind the commands' back. So: cut the room, lay the floor,
hang the door, place the thing — all through `exec` — then look.

From a terminal:

```bash
node apps/mcp/dist/cli.js --project byt get-plan
node apps/mcp/dist/cli.js 'add-object --room kitchen --type sofa-3 --against south'
node apps/mcp/dist/cli.js --picture /tmp/kitchen.jpg get-plan --room kitchen
```

`--project` and `--picture` are the driver's, not the plan's: which plan is being
worked on and what to do with the picture are no part of any plan.

**Headless by default.** With no Chrome on the debugging port — which is the
normal state — the CLI, the MCP server and the scripts start one headless on the
same profile, so nothing pops up in front of you and an agent on its own needs
nothing but `bun run dev`. `scripts/chrome.sh` is only for when you want to
watch, and then the agent drives the window you are looking at. `scripts/editor.mjs`
is the one way in that both cases go through.

An option a plan cannot do without belongs in the schema as required, not as
something with a default nobody checks.

The same holds for the mouse. A drag on the plan is not a second way of moving
things: it is worked out into one `update-object` (`apps/editor/src/edit`), run
through the same store as the command bar and the bridge, and refused by the
same check (`standing-check.ts`) with the same words. The editor calls the
command with typed arguments (`store.apply(updateObject, {...})`); only the
terminal and the MCP tool go through the words (`store.exec(line)`). Neither
the editor nor the logic under it ever builds a line of text for the parser to
read back. If a hand edit needs something a command cannot say, the command
grows — the drag never writes to the document itself.

## Storeys, and the stairs between them

A storey is `add-level`, and the editor stacks them at the foot of the plan's
right edge: one card each, the top floor at the top and the one being drawn
picked out. Cards rather than the parts of one control, because that is what
they are — separate things, each of which can be picked up and put down
somewhere else in the pile. It is a section of the house standing on its end,
so which floor you are on is seen rather than read. Dragging a button up or down
the stack moves that storey in the house and everything on it comes along —
`update-level --storey n`, because the rooms belong to the storey and not to
the height. Hovering one opens its name, its floor-to-floor height and the way
to rename or take it out, beside the button rather than over the plan.

The plan is drawn one storey at a time — that is what a floor plan is — with the
storey underneath showing faintly through, because an upper floor is drawn on
top of the one below and without that there is nothing to line a wall up
against. The flight from the storey below is drawn under this storey's floors,
so what shows of it is exactly what the well leaves showing. Not a ghost and not
a decoration: the stairs really are there, a storey down, and the floor really
is missing over them. Without it an upper floor has an empty hole in it and no
way of telling that the hole is the way down.

**Walked through, it is the whole house.** Every storey at the height it really
stands at, one model of one building, because inside it a house is not one floor
at a time: the stairs out of the hall have to arrive somewhere, the hole they
come up through has to show the room above, and a room with no ceiling is a room
in a house with no upstairs. Which floor you are standing on is the floor the
plan has open, so the storey cards move the walk as well as the drawing, and the
walk starts again on each — where you stood downstairs is as likely as not
inside a wall up here.

The user-facing 3D opens with an overview of the whole building. Exploration
defaults to a free camera: WASD follows the view, Q/E moves down/up, and walls,
slabs and unsupported space do not stop it. The storey cards show their names
and elevations; choosing one starts the camera on that storey's floor. The
small plan in 3D shows the selected storey, not every storey superimposed.
`Walk with collisions` remains available for testing passages and stairs.
Traversal proofs must explicitly call `walkStore.setMovement('walk')` through
the exposed store before keyboard movement; free-camera movement is not proof
that an opening or stair can be walked. These are camera controls, not document
mutations.

A walk opens on clear floor in the biggest room, looking in towards the middle
of it. The room's anchor is where its label hangs, which is under the table as
often as not; opening there put you inside the kitchen run with a wall filling
the view, which reads as the 3D being broken rather than as standing somewhere
silly.

**The storey being looked at is what a command means.** A command that names no
storey works on the one the tab has open, and the tab then follows the command:
`get-plan --level "1. patro"` steps upstairs and everything after it is about
upstairs, and a script that furnishes a bedroom on the first floor leaves you
looking at the first floor. Every answer carries the storeys with `open` on one
of them, so an agent always knows where it is standing. A room named is still
looked for on every storey — which floor the bedroom is on is the plan's
business, not the caller's.

**A thing is not always the rectangle it was cut from.** An L-shaped kitchen's
box takes in the corner it wraps round, which is the emptiest floor in the room
and the obvious place for whatever the box then refuses. So a type may declare
the boxes it really fills — `footprint.ts`, in fractions of its own size — and
every clash is asked of those. The fractions were read off the symbols rather
than guessed at: each drawn onto a sixteen-by-sixteen grid and the inked cells
written down. A U-shaped staircase is deliberately not among them; its flights
and landing fill the whole rectangle however much it looks like a U.

**A room is where a thing stands, not a label it was given once.** Carried over
a threshold, a thing is rehoused in the room it came down in, and the answer
carries a `note` saying so — not a problem, since nothing is wrong, but not
silent either. Reaching over the edge of a room is allowed while a thing is
being carried and refused while one is being put down: something new that hangs
out of the room it was asked for is a mistake. Standing in a wall is refused
either way.

**A node carries no storey; walls do.** So a house of two floors on the same
footprint has two nodes at every corner, and anything looking a node up by
coordinate has to want one this storey's walls hang off — `nodeHere` in
`partition.ts`. Taking whichever came first attaches the upper floor's walls to
the ground floor's corners, and then neither storey closes a room.

**A staircase is drawn, not stamped.** It is the only thing in the catalogue
that is, and the reason is that its size is not its own: the storey's
floor-to-floor height decides how many risers a flight has, how many risers
decides how long it is, and a flight drawn with the wrong number of treads is a
drawing of a staircase nobody could climb. So `stairs.ts` makes the symbol at
the tread count the storey calls for, in the same language the catalogue's own
symbols are written in, and `--depth` on a staircase is refused rather than
obeyed. `--width` is the clear width of the flight, which for a U comes out
twice as wide on the floor.

`treadsOf` is the one description of what a flight is made of, and the symbol,
the model in the walk and the well above are all built from it — the staircase
looked down on and the staircase climbed cannot be two different staircases.
They were: one drawn at the storey's tread count, the other a straight run of
slabs 1400 tall whatever the kind, so a winder came out as a ramp through its
own wall and a spiral as a box. A tread is an outline, not a box, because a
winder turns its corner on three wedges and a spiral is nothing but; and the
treads of a flight are exactly one fewer than its risers, the floor above being
the last step. `armsOf` is the one place that shares them out between the arms,
because when the footprint and the treads counted separately an L came up two
treads through the floor above and a winder stopped three short of it. In the
walk each step is a block one riser tall on the one below, open underneath the
way a stair is, as tall as its storey — the one number a flight cannot be given
in advance is the one that says where its top step is. It also has no symbol to
stamp, and asking every thing in the walk for one dropped every flight in the
house out of the 3D.

**The drawing's left is the thing's right.** A symbol's top edge is the back,
and to put the back against a wall the drawing is laid on the plan turned half
round — so with a thing facing north, the left of its drawing lies to the
east. Everything that says where a part of a thing is goes through `onPlan` in
`standing.ts`: the boxes a click and a clash are tested against, and the well
a flight cuts. A model in the walk is built in the thing's own frame, +x its
right, so a kitchen whose leg is on the left of its drawing builds its leg on
+x. The parts and the stair model were a mirror image of the drawing once,
which is why a click on the arm of a staircase fell through to the floor.

**The well is the staircase, seen from above.** The hole in the floor overhead
is not a thing anybody draws or stores — `wells.ts` derives it from the flight
below, the way rooms are derived from walls. Not the whole flight: over the
first treads there is a storey of air less the slab, and while that is still
the headroom somebody needs (`HEADROOM` and `SLAB` in `levels.ts`) the floor
above stays; the well is the treads without it, taken together, so an L makes
an L-shaped hole and a straight flight the top of its run. One record of a
hole, so the floor drawn with it and the room reporting it can never disagree;
`wellsInRoom` is the single place that decides what of a well is a room's, and
both the renderer and the survey call it. A well that comes up under a wall is
cut along it and each room gets its part — the wall is the fault and the
checks say so, but a hole reaching out of the room it is cut from cannot be
cut at all, which is how a well came to be reported and drawn nowhere.
`check-plan` looks both ways, because either half can be the one that moved: a
wardrobe pushed over a stairwell from upstairs is the same fault as a staircase
built under a wardrobe from downstairs.

**A storey has a lid.** In the walk every room has a slab over it, `SLAB`
thick up to the top of its walls, with a hole where its own staircase comes up
— the ceiling of this storey, the floor of the next, and the roof where there
is no next. Without it a house walked through was an open box. A floor also needs a solid underside
where its footprint extends past the rooms below. Derive only that missing volume
from the upper footprint, retaining wells; do not duplicate the lower ceiling.
The finish is visible from above only. Walls start at their floor, without a
hidden downward extension overlapping the interstorey slab. Slab edges carry a
neutral wall finish separately from the room's ceiling finish.

`bun scripts/look-stairs.ts /tmp/stairs.png [height]` draws every kind at a
storey's height on one page. A generated drawing is code, and the only way to
know code that draws is right is to look at it.

## The tool description never changes

`toolDescription()` in `apps/mcp/src/report.ts` is frozen prose and must stay that
way: it names no command, no object type and no floor material. A description is
part of the prompt, and a prompt that changes throws away the cache of every
conversation using it — so a new sofa in the catalogue would make every agent
everywhere start again from cold. There is a test that fails if a catalogue word
reaches the description.

What it may name is a word that is not going to change: `floorplan("help")` for the
command list and `floorplan("guidelines")` for how a dwelling goes together. Both
are answers, cached like any other, and both can grow without the description
moving. Adding the second cost one cache flush, once, on purpose.

## Do not switch the MCP server on to try something

The tool list is part of the prompt. Attaching the MCP server to a session that
did not have it, or turning it on to test a change, rewrites that list and
throws away every cached token in the conversation — the next request is paid
for from cold, at full price, and a long session is expensive to restart.

So during development the plan is driven from the CLI. `apps/mcp/dist/cli.js` is
the same registry, the same bridge and the same tab as the tool, and running it
changes nothing about the prompt. Anything the tool can do is reachable there,
which is the reason it exists.

Where the server itself has to be exercised — the tool description, the way an
answer is returned, the picture that rides along — say so first, say what it
costs, and let whoever is paying decide. Handing the prompt to a separate agent
is usually the answer: its cache is nobody's loss.

## A plan belongs to a project

The editor opens on a home screen of cards, one to a plan, and a plan is worked on
at an address of its own — `/p/byt-praha`. So the commands work on whichever
project the tab has open: with none open, `exec` refuses and names what there is
to open. Which project that is stays out of the commands — it is no part of any
plan — so it is said to the driver instead: `houseit --project byt-praha …`
navigates the tab there, making one under that name if there is none, through
`window.floorplan.ensureProject`. A person picks it off the home screen; an agent
is told. Neither picks it with `add-room`.

They live in IndexedDB (`apps/editor/src/store/projects`), on two shelves — the
names, dates and thumbnails the home screen lists, and the documents behind them.
The plan is written back a quarter of a second after it stops changing, and once
more on the way out of a project. The single localStorage key this replaced is
lifted into a project called `My plan` the first time the editor starts.

Anything out of `public/` is asked for from the site root — `/textures/…`,
`/symbols/…`, `/plans/…`. A relative path resolves under `/p/<id>`, which the dev
server answers with index.html at status 200: no error anywhere, and a floor whose
texture is a web page renders black.

`scripts/look.mjs` works in a project of its own called `look` and takes it away
afterwards, so the plan you were working on is never touched at all.
`scripts/reset-plan.mjs` empties whichever project is open.

## Look at one object at a time

Furniture is judged by eye, and it cannot be judged in a furnished plan: the thing
is forty pixels across, half under a rug, and every conclusion about what is wrong
with it is a guess dressed up as an observation. Do not guess at a drawing. Look at
it.

```bash
bun run dev                 # the editor on :5173
scripts/chrome.sh           # a Chrome with a debugging port, on its own profile

node scripts/look.mjs --type media-unit --surface walnut --out /tmp/tv.png
node scripts/look.mjs --type sofa-3 --surface grey --width 2.4m --out /tmp/sofa.png
```

`look.mjs` clears the plan, builds a room barely bigger than the one object through
the CLI, frames it, saves a picture, and puts the plan you were working on back.
The object comes out filling the frame, so what is drawn is what you see.

Then read the picture. Crop and enlarge if a detail is in question:

```bash
sips --cropToHeightWidth 400 300 --cropOffset 610 380 /tmp/tv.png --out /tmp/c.png
sips -Z 1100 /tmp/c.png --out /tmp/big.png
```

One object, changed, looked at, then the next. Building a catalogue in one go and
showing it at the end has been tried here, and the whole lot was thrown out.

Rooms are looked at the same way, only in place: run the commands against the real
plan, screenshot it, crop to the corner in question. A room, its floor, its door
and what stands in it are one drawing and have to be judged as one.

## The drawing is seen from straight above

Not from in front, not from an angle: from directly overhead, orthographic, no
perspective at all. Everything drawn has to survive that question — *would you see
this from up there?*

What you see of a thing is its topmost surface and whatever reaches out past it.
Nothing on a vertical face is visible. So:

- a cupboard handle is under the worktop and invisible; what shows is the part of
  it standing off the front edge, and that is the only part worth drawing
- a fridge handle is the end of a bar reaching out past the door, not a mark laid
  on top of the box
- a toilet roll shows its side, not its end, because it hangs on a rod along the
  wall — it draws as a rectangle, and a circle there is a roll on the floor
- a television is its display edge-on: a thin bar, with the stand's legs coming
  out from behind it
- a flush button *is* visible, because a cistern's top face points at the reader

Anything that has to be shown but cannot be seen from up here is a plan
convention, and it should be drawn as a line rather than as a solid — the way a
chair's spindles and a door's swing are.

There is no z-order in the plan, only height — see `stacking.ts`. What covers what
is decided by `layer` (a rug under the furniture, a lamp on top of it), then by a
per-object nudge that keeps two things from flickering against each other.

A box whose face is exactly flush with a wall's face does not render at all. Inset
it.

## Symbol and surface are separate

Furniture is drawn from the reference's plan symbols: one SVG per type under
`apps/editor/public/symbols/`, listed with its real size in
`packages/core/src/catalog.ts`. Both come out of `scripts/import-catalog.mjs`,
which reads the teardown in `.playwright-mcp/surfaces/` — change the mapping there, not
the generated file. `surfaces.ts` is pure fill: the symbol's white becomes the
surface's colour, the lines stay the lines. One bed is white, linen or blue without
there being three beds. A new finish costs a row in `surfaces.ts`; a new piece of
furniture costs a symbol and a row in the import mapping; neither costs the other
anything.

A symbol is scaled to the size its type declares, so it is held to that size by
construction. Its top edge is the thing's back — the side that goes against a wall.

## Bringing a thing in as a model

Most furniture is written: slabs and drums in `scene/walk/models`. A thing can
arrive as a model instead. Drop the `.glb` in `apps/editor/public/models` and add
a row to `packages/core/src/imported.ts` — an id, a label, the size it really is
in millimetres including its height, the finishes it comes in, whether it stands
against a wall, and which rooms it belongs in.

That is all it takes to become a type like any other: `add-object --type wardrobe`
places it, every check tests it, and the plan draws it. A model on its own could
not do any of that, because a thing is placed by its real width and depth and
refused by its footprint, and a mesh carries none of those numbers.

What the model has to be: Y up, x across it, z front to back with the back at
z=0, which is the side that goes against a wall. It is stood on the floor,
centred, and stretched to the size the row declares — so declare the size the
thing actually is, or it will be drawn at one size and checked at another. A
material named `body` takes the object's surface; everything else keeps what the
model came with, so a finish still means something without flattening the work
somebody put into the materials.

If the thing is not a rectangle on the floor, say so with `parts`, in fractions
of its own size, the way `footprint.ts` does for the catalogue's own L-shapes.
The plan draws those parts as well as testing against them, so the corner a
corner bench wraps round is drawn empty and something is allowed to stand in it.
Left out, it fills its rectangle.

`scripts/make-glb.mjs` writes the one that is committed, so an asset in the tree
can be rebuilt and read rather than being a binary nobody can account for.

## What must not be broken

Each of these is held by a test, and each was chosen for a reason the code does
not show on its own.

**The wall graph is topological, not geometric.** A wall that merely crosses
another on screen shares no node with it and therefore divides nothing. Anything
adding walls must split the walls it meets — `partition.ts` calls `splitWall` at
every crossing, which is what makes two rooms share one wall instead of standing
beside each other with a gap. The test that pins it asserts the two rooms' areas
still add up to the whole floor, which is impossible unless the wall is shared.

**A cut comes off a straight side.** Two crossings do not promise a rectangle:
cutting the north off an L-shaped floor meets the boundary exactly twice and
leaves a shallow tail running under the notch. `sideIsStraight` in
`geometry/cut.ts` refuses that rather than drawing a room nobody asked for.

**A door defaults to swinging into the room it was named from.** An explicit
`--opens-into` names an adjacent room or `outside` on an exterior boundary.
The side is worked out when the door is placed and stored on the
opening. It cannot be worked out later: a room is a face of the wall graph, and a
face has no lasting identity.

**Where an opening lands is chosen for you.** `place-opening.ts` puts it in the
middle of the widest stretch of that wall still free, so one command centres a
door and a second falls beside it without either naming a position. `--along`
overrides that with a fraction or a length, and is the exception rather than the
way.

**Coordinates are an output of the design, not an input.** Nobody on a site knows
the kitchen starts at x=4500; they know it is west of the living room and 3.6 m
wide. Commands name rooms and compass sides. `add-room --points` takes literal
corners and is the one way round it — reach for it last.

**Nothing floats.** A fixture anchors to a host — a wall at `{ t, z, side }` or a
level at `{ x, y, z }`, in `core/host.ts` — never to a room, whose extent moves
under it, and never to nothing. It is what will let an electrical layout survive
a change of disposition.

**A script is one transaction.** Every line runs inside a single Immer `produce`;
if one throws, the draft is discarded and the document is untouched.

## Checks

```bash
bun run test        # vitest through turbo; `bun test` at the root is not it
bun run typecheck && bun run lint && bun run depcruise && bun run knip
```

## Browser regressions

Run `bun run test:regression` for the 14 interaction/archive scenarios, or add `--all`
for all 33 UI/display cases and variants. `--only <id,id>` selects cases; `--all --list`
prints the registry. Chrome runs headless by default; `--headed` opens a visible window.
The runner owns a dedicated browser on a free CDP port and reuses an existing editor
or starts its own. It only shuts down processes it started. Keep cases sequential;
headed runs also share system keyboard/mouse input. An explicit `HOUSEIT_CDP_PORT`
must be unused; standalone proof scripts still attach to existing CDP services.

Use `scripts/proof-session.mjs` for new UI regressions: one isolated browser context and
project per case, CLI commands, read-only state, native readiness and a settled camera.
Keep scenario-specific gestures/assertions in the script. `proof.run` saves failure
screenshots, state and Playwright traces before cleanup. Add cases/variants to
`scripts/regression-cases.mjs`; do not silently retry failed assertions. Successful traces
are discarded; logs/screenshots and `report.json` go to an ignored per-run directory under
`test-results/regression/`. Full usage and the separate MCP integration check are in
[docs/regression-tests.md](docs/regression-tests.md). CLI/MCP metadata is unchanged.

## Building vocabulary

`add-room --boundary` accepts a measured wall-centre chain as JSON, each corner
with the thickness of its outgoing wall. It reuses and splits shared walls,
refuses inconsistent thicknesses and overlapping rooms, and assigns exactly one
face. It is the way in from construction documentation; independent walls also use `add-wall` / `update-wall` / `remove-wall`. Prefer relative cuts for ordinary design.

`update-room --exterior` dresses exterior walls with named layers and colour
bands measured above the storey's floor. The outside comes from the wall graph.
`update-level --roofs` takes explicit roof patches with finish, depth, parapet,
fall and drains; `--slab-thickness` controls the soffit.

`--clear-height` states a section's soffit independently of its finished floor-to-floor
height. The structural slab and the floor buildup above it are not the same height.
Columns normally stand on clear floor; `--embedded` also permits columns partly
in walls. Only the part projecting into clear floor is subtracted from room area.

`add-stair --flights` takes measured flights with risers, going, direction and
landing outlines. The same treads make the plan, the concrete in 3D, the holes
above and the surface walked. `--base-offset` carries a stair whose lower finished
landing differs from the storey datum. An enclosed shaft takes `--enclosure`;
its clear dimensions exclude the wall thickness and its enclosing footprint is
excluded from each surrounding room.

An enclosed services shaft may use `--around-columns` when its drawn bounding
void wraps an existing structural column. This does not apply to lifts. Columns
and shaft casings occupy the union of their footprints, so overlapping occupied
floor is subtracted once.

Structural columns use `add-column`, `update-column`, `remove-column`. Their grid
coordinates belong to a level and their height follows the soffit. Shafts and
ramps use `add-shaft` / `remove-shaft` and `add-ramp` / `remove-ramp`, each with a
lower host level and an upper destination. Their slab holes are derived, just
like stair wells. Walking follows the ramp and stair surfaces and refuses walls,
fixed glazing, columns and unsupported holes.

An `add-opening --kind assembly` is one product with rectangular fixed and door
panels and a frame. Panels must tile the opening exactly without overlaps. The
plan, 3D and traversal derive its parts from that one record.
For a solid door under a glazed fanlight, the door panel takes `glazing: "none"`.
Its opaque inner and outer faces keep the frame colours; the fanlight stays glass
and the open door remains walkable.

`add-opening` and `update-opening` accept `--hinge left|right` for hinged doors
and assemblies with door panels, viewed from the side the door opens towards,
facing the closed leaf. `--opens-into <room>|outside` sets that side. The answer
reports that handedness and `opensInto`; moving a door preserves its handedness
even when its new wall runs the opposite way. Changing only its swing direction
keeps the physical hinge jamb. Each assembly leaf is checked against obstacles
at its own width. A framed glass leaf carries its frame in both plan and 3D,
including the separately coloured inner and outer faces.

The receiving side comes from the room's directed boundary edge. A concave
corridor's centroid can lie across its own wall; using it reversed doors that
explicitly opened into that corridor. Placement, updates and readback must use
the same local boundary side.

A plain hinged door accepts `--leaf-width` for the main leaf of an unequal pair.
`--width` remains the whole passage; `--hinge` names the main leaf's outer jamb.
Both leaves swing from outer jambs, without a centre post. `update-opening
--leaf-width 0` restores a single leaf.

Pocket doors use `--slide-towards north|south|east|west`. The CLI checks the
wall pocket and stores its direction; without an explicit direction it chooses
a free side. Both plan and 3D show the leaf retracted into that pocket, leaving
the same passage that can be walked. Other openings may not occupy the pocket.

The driver's `window.floorplan.show({view: 'north'})` also supports south, east,
west, roof and overview. It changes only the camera, never the document. These
views exist to compare a model against its elevations and roof drawing.

Site ramps use `--to-elevation` instead of `--to`, with `--base-offset` for the
lower finished floor. Both plan and walking use the same run and end levels.
`add-shaft --kind services` can occupy one storey; its enclosure need not have
a door. Composite windows accept `--sill`, casement and tilt-turn panels,
opaque infill panels and `glazing: "frosted"` where the schedule calls for it.

Rebuild specimens through `scripts/building-proof.mjs fixtures/building-proof/<name>.txt`.
The fixtures are capability specimens, not the real building or acceptance data.

`update-room --return` adds a measured open partition or low lining with
`{points:[{x,y},...],thickness,height}`. It starts on the room's wall centre line
and ends inside it, without enclosing another room. The boundary walks both
sides of the free end, so the same wall is drawn, stood in 3D, walked around and
subtracted from clear floor area. Enclosure walls may coincide with existing
walls; shaft voids may not cut through them. Only the enclosure portion on clear
floor is subtracted, rather than counting wall area twice.

`update-room --partition` takes the same fields with exactly two points for a
straight orthogonal partition whose two ends remain free inside the room.
It reports its endpoints, thickness and height with the room. Its occupied
floor is subtracted without closing a new room, and both ends can be walked
around. Use `--return` when one end meets the enclosing wall.

## Exterior site

`update-site --site` replaces site surfaces, road/parking markings and railings
as one JSON transaction. The answer includes the site, so it can be read back
without inventing outdoor rooms. Surface elevations are absolute millimetres
above the building datum at the first outline point; slope components are rise/run.
Markings follow their host surface. Railings carry endpoint elevations, infill,
post spacing and optional rail heights. Named floor materials can dress paving.
The site cuts out the background lawn; its terrain must cover the replacement
area while preserving the building and ramp voids. Site geometry is drawn in
3D and on the datum floor plan. `add-column --outside` explicitly permits a
structural support beyond enclosed rooms; wall, shaft and object clash checks
still apply. An exterior finish can replace a basement floor buildup where their
height ranges intersect, but never removes the structural slab or the buildup
under an upper room.

Exterior bands accept `along: {from,to}` in millimetres from the wall's first
node. This limits a colour region horizontally without splitting the wall or
its rooms. A band ending at a wall endpoint also covers the coat's corner return.
An exterior `base` may extend its plinth below the finished floor datum.

Roof `baseOffset` is relative to the storey top: a negative value places the roof
on its structural slab, replacing the ordinary floor buildup there. `facets`
carry triangular surface vertices `{x,y,height}` above that base, with optional
material per triangle. The CLI refuses incomplete, overlapping or out-of-bounds
meshes and drains outside their surface. Parapet `edges` select runs and colours;
`coping` sets cap thickness. The default rectangular fall remains available.

Site finishes can also be changed individually with `update-site --surface <id>
--material asphalt` or `--colour "#rrggbb"`. Concrete, concrete pavers, asphalt,
roof gravel and sedum have offline textures. Choosing a material resets tint to
white unless a colour is supplied with it.

`window.floorplan.show({view: 'north', site: false})` hides site context for an
unobstructed elevation review, without changing the model. Orthographic building
views frame the building even when its terrain extends much farther. Actual
scene sections can be exported with `bun scripts/takeoff-sections.ts <readback>
<out>`; their straight cut coordinates are printed on the drawing. They are not
an automatic claim to reproduce an architect's offset section path.
