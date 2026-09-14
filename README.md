# houseit

A floor plan editor you drive by talking to a coding agent.

You describe the house in plain language. Claude Code or Codex translates that into
commands, sends them through an MCP server to the browser tab, and the plan redraws in
front of you. Then you grab a wall and drag it, because some things are faster by hand.

Everything runs on your machine. No backend, no account, no network.

## How it works

```
  you ──▶ agent (Claude Code / Codex)
                │
                │  one MCP tool: floorplan("add-room --name kitchen …")
                ▼
          MCP server ──── CDP ────▶ Chrome tab
                                      │
                                      ▼
                                 window.floorplan.exec()
                                      │
                                      ▼
                              document ──▶ redraw
```

The MCP server holds no state. The browser tab owns the document, so what the agent
reads back is exactly what you see. Every command returns JSON — the resulting plan and
any warnings — so the agent works from structured data, never from pixels.

The same command registry also ships as a plain CLI binary. `houseit add-room --name
kitchen` from your terminal does the identical thing, with no agent involved. A whole
script goes as one argument, lines and quotes and all, or on standard input:

```bash
node apps/mcp/dist/cli.js add-room --name "master bedroom" --from house --side north --width 4m
node apps/mcp/dist/cli.js 'add-opening --room "master bedroom" --kind door --side south'
node apps/mcp/dist/cli.js - < plan.txt
node apps/mcp/dist/cli.js --project byt-praha get-plan   # in that plan, made if new
node apps/mcp/dist/cli.js --picture /tmp/kitchen.jpg get-plan --room kitchen
node scripts/reset-plan.mjs        # empties the plan in the tab, for starting over
```

## The model and architecture

The active migration branch is **`that-open-engine`**. Its native display and
regression branches are already included in its history. See [TECHNOLOGY.md](TECHNOLOGY.md)
for module boundaries, [goal.md](goal.md) for remaining engine migration, and
[maintenance progress](docs/maintenance/progress.md) for the separate maintenance work.

**Native authoring owns the project.** `FragmentAuthoring` commits typed commands
and CLI scripts into a That Open `SingleThreadedFragmentsModel`. Native items,
relationships and request boundaries own editing and undo/redo. `HouseDocument`
(version 5) is the read projection consumed by domain rules and UI. Immer supplies
transaction drafts; the editor's undo history uses native requests.

**Walls are independent elements.** `add-wall`, `update-wall` and `remove-wall`
operate on stable element IDs. Intersections split wall topology into segments.
Closed spaces are derived from that graph. Named rooms have stable IDs, boundary
references, anchors and finishes; their areas and visible polygons are derived.

**Hosts express relationships.** Wall-mounted devices store a wall reference,
position along it, height and side. Level hosts store a level and local coordinates.
Wall edits preserve or explicitly reject invalid hosts. Furniture uses room
relationships and placement parameters. Coordinates are integer millimetres in
the domain and converted to metres at the presentation boundary.

**That Open and Houseit have distinct responsibilities.** GeometryEngine generates
supported geometry in a worker; Fragments displays it and supplies native picking,
snapping, measurements and sections. Houseit supplies construction rules, floor-plan
symbols, materials and gestures. React/R3F hosts the scene and UI. Full archive
geometry and the remaining authoring migration are tracked separately in `goal.md`.

## Commands

One MCP tool, `floorplan`, takes a command string. The registry includes levels,
independent walls, rooms, openings, furniture, columns, shafts, ramps, stairs,
site surfaces and electrical devices. `get-plan` reads without changing the document
or history. `help` supplies the current command reference.

```
add-level      --name "1. patro" [--height 2.7m] [--below]
update-level   --level "1. patro" --name podkroví --height 2.4m
remove-level   --level podkroví

add-room       --material natural-oak --shape l --width 12m --depth 9m --notch-width 4m --notch-depth 3m --name house
add-room       --material tile-white --name kitchen --from house --side west --width 3.6m --kind kitchen
add-room       --material tile-white --name snug --points "0,0; 5m,0; 5m,3m; 3m,3m; 3m,5m; 0,5m"
add-room       --material tile-white --name pantry --from house --side north --along 0 --walk "3m s, 4m e, 3m n"
update-room    --room kitchen --name kuchyň --kind kitchen --material tile-slate
update-room    --room kitchen --side east --by 300
remove-room    --room pantry --into kitchen

add-opening    --room kitchen --kind door --side east --variant pocket
add-opening    --room kitchen --kind window --side north --width 1.2m --along 2.4m
add-opening    --room snug --kind window --wall w12
update-opening --id o7 --width 1.5m --to-side west
remove-opening --id o7

add-object     --room kitchen --type sofa-3 --against south --surface linen
update-object  --id f3 --against west --rotation 90 --width 2.4m
remove-object  --id f3

get-plan       --room kitchen
```

Several commands separated by newlines apply as one transaction — all of them land, or
none do.

Independent walls can exist before any room has been named:

```bash
add-wall --from '{"x":0,"y":0}' --to '{"x":6000,"y":0}' --thickness 300
update-wall --id w1 --length 6500
remove-wall --id w1
```

Close the wall graph, then use `add-room --at '{"x":2000,"y":2000}'
--name kitchen --material natural-oak` to name an existing space. Drawing an entire
room through `add-room --shape` is also supported.

A room is cut out of a room: a strip off a side, a box out of a corner, any shape by
its corners (`--points`, from the south-west corner of the floor) or by a walk of legs
from a side (`--walk`). With nothing to come out of, `add-room` draws the outline of the
floor itself. Walls are found by the side of the room they face — and a side is every
wall facing that way, so an L has two north walls, told apart by number and by id;
`--wall w12` names one where `--side` would name the longest. `--along` is a fraction of
the wall (0 at its west or south end) or a length from that end: `0.3`, `2.4m`, `-1m`
for a metre short of the far end.

Every command answers the same way, whether
it changed everything or nothing:

```json
{ "level": "…", "changed": ["f7"],
  "rooms": [ { "name": "kitchen", "areaM2": 15.1, "width": 4200, "depth": 3600,
               "walls": [ {"id":"w3","side":"north","length":4275} ],
               "sides": [ { "side": "north", "walls": [{"id":"w3","from":0,"to":4275}],
                            "length": 4275, "openings": [],
                            "objects": [ {"id":"f1","type":"kitchen-l","from":1462,"to":4713} ],
                            "free": [ {"from":0,"to":1462} ] } ],
               "openings": [ {"id":"o4","kind":"door","side":"south","along":0.5,"to":"hall"} ],
               "objects": [ {"id":"f7","type":"sofa-3","against":"south","along":0.5} ] } ],
  "problems": [] }
```

The rooms it touched, read back in full — every wall with what opens and stands on it
and **the stretches still free**, which is what the next placing needs — and everything
now wrong with the plan. Over MCP it comes with a picture of what the command did,
framed the way a click would show it: one picture for the call, not one a line.

`get-plan` is the one question left, and it is only for the rooms a command did not
touch. `update` and `remove` take the `--id` the answer gave — an id is one thing in
the whole house, so it brings its storey with it. A room is looked for on every
storey too: `--room ložnice` finds the bedroom wherever it is, and `--level` is for
saying which when you mean to.

The problems are the ones The reference's review looks for: a room nobody can walk to from the
front door, a bedroom opening straight into the kitchen, a door that cannot swing for
the sofa in front of it, a laundry too small to be one, a living room with no window, a
kitchen with no fridge. They ride along in every answer rather than waiting behind a
question, so the command that put the chair in the doorway is the one that says the door
cannot open. What sort of room a room is comes from `--kind`, or from its name — in
English or Czech. An empty list is what a finished plan gets.

Editing by hand on the plan goes through the same door. Dragging a thing ends in one
`update-object`, R turns it with `--rotation`, Delete is `remove-object`; a door or a
window dragged along its wall, or to another wall of the room, is `update-opening`, and
Delete takes it out — so a sofa dragged into a wall, or a door dragged to where the
wardrobe would stop it opening, snaps back with the command's own refusal, every edit
undoes, and the agent's next answer tells it what was done by hand.

The panel down the plan's right edge shows what is picked and lets it be changed: a room's name,
kind and floor, a thing's finish, size and turn, a door's kind and width, a window's width,
height and sill. Each field is one command — `update-room`, `update-object`,
`update-opening` — and a field the plan refuses goes back to what the plan says, with the
refusal as a toast.

What is picked goes violet where it is drawn — a room's walls and floor, a thing's picture,
a door, a wall — and whatever the pointer is over goes a paler violet first. A picked thing
has a handle at its front to turn it by; a picked wall stub has one at its free end to pull
it. A wall carried across the plan takes the rooms with it as it goes — the floors either
side, the walls that meet it, the labels — because the drawing runs the command the drop
would run on a copy of the plan and draws that; so does a stub being pulled, and a wall
being drawn. Everything but the plan floats over it in frosted glass, so nothing that
opens or folds away can move the plan. Down the left edge is the rail: the mark at its
head and a column of tabs under it — Rooms, Levels, Issues, Catalogue, with nothing behind
them yet — folded to its icons or pulled out to their names by a drag on its edge. Two
small cards over the top right corner hold undo and redo, and a gear for the measurements
and for fitting the plan to the window; under them are the tabs for 2D and 3D. The panel
comes out when something is clicked and goes when the pick is cleared; the gear's button,
⌘B, or a drag on its edge folds it away until the next click. The bar along the foot is
centred on the part of the plan nothing stands over, and moves across as the rail and the
panel come and go. Fit frames the plan in that part too, and a picture taken for the agent
is of it. The editor is built on shadcn/ui in the colours of warm paper, ink and violet,
on a paper of dots.

The 3D tab switches to the same plan walked through at eye height. Walls
stand at their real height with a sill under every window and a head over every opening,
the glass in the windows, and doors standing open the way the plan draws them. The
furniture is modelled, type by type, from slabs, drums and balls in the thing's own frame
(`scene/walk/models.tsx`): a bed is a frame, a mattress, a duvet, pillows and a headboard,
a kitchen is runs of cabinets under a worktop with handles along the front, a dining table
has its chairs round it with their backs outward, and a lamp stands on whatever is under
it. Each is as tall as its type says (`core/heights.ts`) and in its finish — the wood and
stone finishes borrow the floor photographs for their grain, tinted towards the finish's
colour (`scene/walk/finish.ts`). A type without a model yet is the box it takes up with its
plan symbol on top. Every model was built and then looked at, from a couple of metres off in
the walk, before the next. W, A, S, D walk and
sidestep, the arrows walk and turn, shift runs, a drag turns the head, and a click picks
whatever is clicked, for the panel. A minimap under the tabs shows the plan with a violet
dot where you stand and a wedge as wide as what you see; a click on it moves you
there. Nothing is dragged in 3D — it is a way of looking, not a second way of editing —
and a picture asked for over MCP always comes as a plan.

The bar along the bottom of the plan says what the next click does. Furniture opens
upward — a category to the side, a search at the top — and Structure holds the doors and
the window. Pick one and the next click on a room puts it there — `add-object` against the
nearest wall or out in the room, `add-opening` in the nearest wall, each with
the exact `--along` the click meant. Shift keeps it armed for the next click; Escape lets
go. Draw wall is the pencil: a click puts a corner down, the line to the next follows the
pointer square to the last one — north, south, east or west, never in between — snapping
to the corners and walls it comes near, the rooms it would make showing as it goes. A click
on the last corner, or on the first, or Enter finishes; Escape throws it away. Drawing compiles into typed `add-wall` commands, joining each leg to the topology it crosses or reaches.

Walls move too. Pick an independent wall and drag it: `update-wall` moves the element.
A room boundary handle uses `update-room --wall` for its segment. Connected walls move, the walls meeting it stretch or shorten, the doors
in them keep their distance from the end that stayed, and the rooms either side grow and
shrink — refused where a wall would shorten to nothing, a window would be pushed off its
wall, or something would be left standing in masonry. A room's panel knocks it through
into a neighbour with `remove-room`: the wall between them goes, and what stood in the
room stays where it stood. A garage or a terrace is a room like any other — `add-room`
cuts it and says what it is with `--kind`.

Shapes are made the way a builder makes them. The floor starts as a rectangle, an L, a U,
a T, or a walk round any outline — `add-room --shape`, with nothing to come out of, from
the panel while the plan is empty. A room is cut off a side or out of a corner of another
— a stepped side too, and what comes off a stepped side is L-shaped. The pencil uses the same independent wall commands, including open partitions.

Each command is declared once, with a Zod schema for its arguments. That single
declaration drives parsing, validation and generated command help. The MCP tool title,
description and input schema stay stable; help is returned as data.

## Floors

Each room can take a floor material:

```
update-room --room kuchyň --material natural-oak
```

Materials, photographed and brought in from the reference: `white-oak`, `natural-oak`,
`red-oak`, `ash`, `beech`, `birch`, `tile-white`, `tile-beige`, `tile-blue`,
`tile-seafoam`, `tile-slate`, `tile-hex-mint`, `tile-herringbone`, `tile-terracotta`,
`marble-white`, `marble-beige`, `calacatta`, `limestone`, `granite`, `soapstone`,
`concrete-light`, `concrete-dark`, `terrazzo-stone`, `brick-beige`, `brick-grey`,
`brick-red`. All of them tile seamlessly and are laid at their real size, so a
300 mm tile is 300 mm in any room and boards run on across a doorway.

Projects live in IndexedDB and autosave after a 250 ms pause. A failed save shows
**Changes not saved** at the top right with **Retry save**; success updates the same
toast. Closing waits for persistence and keeps the project open on failure. The
latest unsaved revision stays in the tab, so retry before leaving or reloading.

## Furniture

```
add-object --room living --type sofa-l --against east --surface grey
add-object --room living --type dining-6 --along 0.86 --across 0.74
add-object --room office --type office-desk --against west --surface walnut
```

A thing is put in a room, never at coordinates. Name a side and it backs onto
that wall; leave the side out and a free-standing thing goes to the middle of
the room, a wall-standing one to the roomiest wall. `--along` says where along
the wall (or across the room) from 0 to 1, `--across` how far up a free-standing
thing stands, and both are checked like any other place — the command refuses a
spot where something already is. `--rotation` turns it about its own middle.

The catalogue — 94 types, from `queen-bed` and `nightstand` through `kitchen-l`,
`island-4`, `refrigerator`, `bathtub`, `office-desk-l`, `washer-dryer`, `sedan` to
`pool-table` — is the reference's, brought in by `node scripts/import-catalog.mjs` from the
teardown in `features.md` and kept as data in
`packages/core/src/catalog.ts`. Each type is one plan symbol scaled to the
type's size, with its white swapped for the surface it was given. `--help` on
`add-object` lists every id.

## Storeys and stairs

A command that names no storey means the one being looked at, and the editor
follows the command: `get-plan --level "1. patro"` steps upstairs, and so does
the plan on screen. Every answer lists the storeys with `open` on one of them,
so the agent always knows which floor it is standing on.

`add-level` builds upwards and `--below` builds a cellar. The editor stacks the
storeys at the foot of the plan's right edge, one round button each, the top floor
at the top and the one you are drawing filled in: a click steps onto a storey, a
drag moves it in the house and takes its rooms with it, and hovering one opens its
name, its height and the way to rename or remove it. The plan is drawn one storey at
a time, with the one underneath showing faintly through so an upper floor has
something to line up against.

A staircase is the one thing in the catalogue that is **drawn rather than stamped**:
the storey's floor-to-floor height decides how many risers a flight has, and that
decides how long it is. So its length is never asked for — `--depth` on a staircase
is refused — and `--width` is the clear width of the flight. Five kinds: straight,
L with a landing, L with winders, U, and spiral.

```
add-object --room hala --type stairs-u --against north --width 1m
```

The hole in the floor above is not a thing anybody draws. It is the staircase, seen
from the storey above: the floor up there is cut round it, the room reports it, and
`check-plan` says so whether you put a wardrobe over the stairwell or built the
stairs under the wardrobe.

## Doors

```
add-opening --room entry --kind door --side south --width 914
add-opening --room hall --kind door --side south --width 1.6m --variant sliding
add-opening --room garage --kind door --side south --variant garage
add-opening --room pantry --kind door --side east --variant pocket
```

Hinged unless said otherwise, and drawn with its leaf and swing. A sliding door
is two lapped panels, a pocket door one that runs into the wall, and a garage
door a panel across the whole opening. Each has its own default width.

## Plans by address

```
http://localhost:5173/?plan=sample-house
```

A plan named in the address is drawn in place of whatever the browser had: the
editor fetches `public/plans/<name>.txt` — a command script, the same lines the
agent sends — and runs it. That is how a plan becomes a thing with a URL.
`sample-house` is a furnished two-bedroom house after the one the reference drew.

To check a script without a browser, line by line:

```
bun scripts/run-plan.ts apps/editor/public/plans/sample-house.txt
```

It stops at the first line that fails, says why, and lists every room with its
size and everything standing in it.

## Scope and layout

Implemented: 2D plans, 3D walkthrough/inspection, independent walls, openings,
furniture, multi-storey structures/site, native tools, local projects and native
undo/redo. Electrical device commands and host relationships exist; full electrical,
plumbing and HVAC design workflows remain extension work. See the
[extension contracts](docs/maintenance/discipline-extensions.md) and
[performance measurements](docs/maintenance/performance.md).

| Location | Responsibility |
| --- | --- |
| `packages/core` | Document schemas, migrations, hosts and catalogue data |
| `packages/geometry` | Topology-derived rooms, dimensions, placement and building geometry rules |
| `packages/commands` | Typed commands, CLI parser, validation and structured readback |
| `packages/scene` | Renderer-independent piece/material descriptions |
| `packages/bridge` | Public browser/driver contract |
| `apps/editor/src/engine` | That Open authoring, generation, display and native tools |
| `apps/editor/src/store/projects` | Project lifecycle, native snapshot persistence and save state |
| `apps/editor/src/edit` | UI gestures translated into typed commands |
| `apps/editor/src/ui` | Navigation, panels and notices |
| `apps/mcp` | Node CLI/MCP driver using Playwright/CDP |

Library packages have no React, Three.js or Node runtime dependencies. Build-time
rules enforce those boundaries. UI inspectors are split by element; furniture
presentation, dragging and rotation have separate modules.

## Driving it from an agent

Three things have to be running: the editor, a Chrome the bridge can attach to, and
the MCP server itself.

```bash
bun install
bun run --cwd apps/editor dev          # the editor, on :5173
bun run --cwd apps/mcp build           # bundles the server and the CLI
./scripts/chrome.sh                    # Chrome with a debugging port, on the editor
```

**The server runs on Node, not Bun.** Playwright's websocket client does not work
under Bun — `connectOverCDP` hangs until it times out — so both entry points are
bundled and run with `node`. Everything else in the repo is Bun.

**Claude Code** picks up `.mcp.json` from the repo root, so opening a session here
is enough. To register it globally instead:

```bash
claude mcp add houseit -- node /absolute/path/to/houseit/apps/mcp/dist/server.js
```

**Codex** reads `~/.codex/config.toml`:

```toml
[mcp_servers.houseit]
command = "node"
args = ["/absolute/path/to/houseit/apps/mcp/dist/server.js"]
```

Then just say what you want — *"udělej dispozici 12 na 9 metrů, kuchyň na západ"* —
and watch the tab. The agent reads the command reference through `floorplan("help")`. The tool
description remains stable as the command registry grows.

**Without an agent**, the same commands work from a terminal against the same tab:

```bash
node apps/mcp/dist/cli.js --help
node apps/mcp/dist/cli.js --project byt add-room --shape l --width 12m --depth 9m \
  --notch-width 4m --notch-depth 3m --name dům --material natural-oak
node apps/mcp/dist/cli.js add-room --name kuchyň --from dům --side west --width 3.6m \
  --material tile-white
node apps/mcp/dist/cli.js --picture /tmp/kuchyň.jpg get-plan --room kuchyň
```

With no Chrome on the debugging port, the CLI starts one headless on the same profile —
so an agent on its own needs nothing but the dev server, and `--project` puts it in a
plan, making one under that name if there is none.

## Editor regression tests

Run `bun run test:regression` for selection, dragging, wall junctions, openings, undo and
archive reload. Add `--all` for the native display specimens, or `--only plan,tools` for
selected cases. Chrome runs headless by default; add `--headed` to watch. The runner starts its own
browser and any missing local editor, isolates
each test project and writes logs, screenshots and failure traces to `test-results/`.
See [the regression guide](docs/regression-tests.md) for scenario IDs and debugging.
