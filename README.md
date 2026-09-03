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
kitchen` from your terminal does the identical thing, with no agent involved.

## The document model

Five ideas carry the whole thing. They are worth understanding before touching the code,
because everything downstream — 3D, electrical layouts, plumbing — depends on them.

**The plan is 3D from the start.** Walls carry height and base offset; the document has
levels. The floor plan view is an orthographic camera looking down at the same scene the
3D view uses. There is no separate 2D model.

**Walls are a graph, rooms are not stored.** The document holds nodes and wall segments.
Rooms are derived by finding the faces of that graph, recomputed after every edit. One
source of truth, so a plan can never be internally inconsistent. Drag a wall and every
room touching it updates itself.

**Nothing has absolute coordinates.** A socket is not a point in space — it is
`{ wall: 'w3', t: 0.4, z: 300, side: 'a' }`. Move the wall and the socket moves with it.
This is the single decision that makes electrical layouts possible later; anchoring
things absolutely would scatter them across the room on the first dispositional change.

**Rooms have no stable identity, so labels are anchors.** Because rooms are derived,
they cannot host anything and cannot carry a name. A room name is a point —
`{ level, x, y, name: 'kitchen' }` — matched after each edit to whichever face contains
it. That is what keeps the kitchen labelled as the kitchen after you move a partition.
Ceiling fixtures host on the level for the same reason.

**Elements are tagged by discipline.** `architecture`, `electrical`, `plumbing`, `hvac`.
Disciplines drive layer visibility, and both the plan view and the 3D view are the same
pure function of `(document, visible layers)`.

All lengths are integer millimetres. Never floats — accumulated drift stops nodes from
coinciding, and face detection collapses when they do not.

## Commands

One MCP tool, `floorplan`, taking a command string. It parses like a CLI:

```
floor-shape  --material natural-oak --kind l --width 12m --depth 9m --notch-width 4m --notch-depth 3m --name house
add-room     --material tile-white --name kitchen --from house --side west --width 3.6m
add-door     --room kitchen --side east --variant pocket
add-window   --room kitchen --side north --width 1.2m --along 0.3
move-window  --room kitchen --side north --to-side west
add-object   --room kitchen --type sofa-3 --against south --surface linen
move-object  --room kitchen --type sofa-3 --against west
turn-object  --room kitchen --type sofa-3 --by 90
set-surface  --room kitchen --type sofa-3 --surface linen
rename-room  --room kitchen --name kuchyň
set-room-kind --room snug --kind living
move-wall    --room kitchen --side east --by 300
add-wall     --room living --side north --along 0.3 --length 2.5m
draw-wall    --room living --side north --along 0.6 --walk "3m s, 2m e"
remove-room  --room pantry --into kitchen
describe     --room kitchen
measure      --room kitchen --side north
check-plan
```

Several commands separated by newlines apply as one transaction — all of them land, or
none do.

Two of them only look. `describe` says what is there — every room's clear size, floor,
neighbours, doors with where they lead, windows, and what stands in it, all in the same
words the other commands take. `measure` puts a tape on the plan, a room, one side of a
room (what is on it and what is still free) or a thing in it (its distance to each
wall). Both answer with JSON, and over MCP the answer comes with a picture of what was
asked about, picked out and framed the way a click would show it. So the agent ends a
script with `describe --room kitchen` and sees the kitchen it just made.

`check-plan` reads the plan for trouble the way The reference's review does: a room nobody can
walk to from the front door, a bedroom opening straight into the kitchen, a door that
cannot swing for the sofa in front of it, a laundry too small to be one, a living room
with no window, a kitchen with no fridge. What sort of room a room is comes from its
name for now, in English or Czech. An empty list is what a finished plan gets.

Editing by hand on the plan goes through the same door. Dragging a thing ends in one
`move-object`, R turns it with `turn-object`, Delete is `remove-object`; a door or a
window dragged along its wall, or to another wall of the room, is `move-door` or
`move-window`, and Delete takes it out — so a sofa dragged into a wall, or a door
dragged to where the wardrobe would stop it opening, snaps back with the command's own
refusal, every edit undoes, and the agent's `describe` tells it what was done by hand.
Where there are two of a kind, `--nth 2` says which; `describe` numbers them the same way.

The inspector beside the plan shows what is picked and lets it be changed: a room's name,
kind and floor, a thing's finish, size and turn, a door's kind and width, a window's width,
height and sill. Each field is one command — `rename-room`, `set-room-kind`, `set-floor`,
`set-surface`, `resize-object`, `turn-object`, `set-door`, `set-window` — and a field the
plan refuses goes back to what the plan says, with the refusal as a toast.

What is picked goes blue where it is drawn — a room's walls and floor, a thing's picture,
a door, a wall — and whatever the pointer is over goes a paler blue first. A picked thing
has a handle at its front to turn it by; a picked wall stub has one at its free end to pull
it. A wall carried across the plan takes the rooms with it as it goes — the floors either
side, the walls that meet it, the labels — because the drawing runs the command the drop
would run on a copy of the plan and draws that; so does a stub being pulled, and a wall
being drawn. Two small cards over the plan's top right corner hold undo and redo, and a
gear for the measurements and for fitting the plan to the window. The inspector floats
over the plan's right edge rather than beside it, so folding it away — the gear's button,
⌘B, or a drag on its edge — moves nothing underneath. Fit frames the plan in the part of
the canvas nothing floats over, and a picture taken for the agent is of that part. The
editor is built on shadcn/ui, on a paper of dots.

The tabs at the top left switch to 3D: the same plan walked through at eye height. Walls
stand at their real height with a sill under every window and a head over every opening,
the glass in the windows, and doors standing open the way the plan draws them; the
furniture is the box each thing takes up, as tall as its type says (`core/heights.ts`),
in its finish, with its plan symbol laid on top so it still reads. W, A, S, D walk and
sidestep, the arrows walk and turn, shift runs, a drag turns the head, and a click picks
whatever is clicked, for the inspector. A minimap under the undo card shows the plan with
a blue dot where you stand and a wedge as wide as what you see; a click on it moves you
there. Nothing is dragged in 3D — it is a way of looking, not a second way of editing —
and a picture asked for over MCP always comes as a plan.

The bar along the bottom of the plan says what the next click does. Furniture opens
upward — a category to the side, a search at the top — and Structure holds the doors and
the window. Pick one and the next click on a room puts it there — `add-object` against the
nearest wall or out in the room, `add-door` or `add-window` in the nearest wall, each with
the exact `--along` the click meant. Shift keeps it armed for the next click; Escape lets
go. Draw wall is the pencil: a click puts a corner down, the line to the next follows the
pointer square to the last one — north, south, east or west, never in between — snapping
to the corners and walls it comes near, the rooms it would make showing as it goes. A click
on the last corner, or on the first, or Enter finishes; Escape throws it away. The drawing
is one `draw-wall`: a walk of legs from where it started, on a side of a room or on the
paper, every leg a wall joined to whatever it crosses or reaches.

Walls move too. Pick one and drag it across itself and it becomes one `move-wall`: the
whole line of it moves, the walls meeting it stretch or shorten, the doors in them keep
their distance from the end that stayed, and the rooms either side grow and shrink —
refused where a wall would shorten to nothing, a window would be pushed off its wall, or
something would be left standing in masonry. A room's panel knocks it through into a
neighbour with `remove-room`: the wall between them goes, and what stood in the room
stays where it stood. A garage or a terrace is a room like any other — `add-room` cuts
it, `set-room-kind` says what it is.

Shapes are made the way a builder makes them. The floor starts as a rectangle, an L, a U,
a T, or a walk round any outline (`floor-shape`, from the panel while the plan is empty).
A room is cut off a side or out of a corner of another — a stepped side too, and what
comes off a stepped side is L-shaped. `add-wall` puts a wall in from a side: right across,
and the room is two; or a stub of a length, and the room has an alcove, the arm of a T.
Two stubs meeting close a room between them. On the plan the wall tool is a drag from a
wall into the room; the room's panel cuts rooms off it.

Each command is declared once, with a Zod schema for its arguments. That single
declaration produces the CLI parser, the MCP tool description the agent reads, the
`--help` text, and the runtime validation. Adding a command means adding one file.

## Floors

Each room can take a floor material:

```
set-floor --room kuchyň --material natural-oak
```

Materials, photographed and brought in from the reference: `white-oak`, `natural-oak`,
`red-oak`, `ash`, `beech`, `birch`, `tile-white`, `tile-beige`, `tile-blue`,
`tile-seafoam`, `tile-slate`, `tile-hex-mint`, `tile-herringbone`, `tile-terracotta`,
`marble-white`, `marble-beige`, `calacatta`, `limestone`, `granite`, `soapstone`,
`concrete-light`, `concrete-dark`, `terrazzo-stone`, `brick-beige`, `brick-grey`,
`brick-red`. All of them tile seamlessly and are laid at their real size, so a
300 mm tile is 300 mm in any room and boards run on across a doorway.

The plan is saved in the browser as you go, so a reload picks up where you left
off.

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
spot where something already is. `--turn` turns it about its own middle.

The catalogue — 94 types, from `queen-bed` and `nightstand` through `kitchen-l`,
`island-4`, `refrigerator`, `bathtub`, `office-desk-l`, `washer-dryer`, `sedan` to
`pool-table` — is the reference's, brought in by `node scripts/import-catalog.mjs` from the
teardown in `features.md` and kept as data in
`packages/core/src/catalog.ts`. Each type is one plan symbol scaled to the
type's size, with its white swapped for the surface it was given. `--help` on
`add-object` lists every id.

## Doors

```
add-door --room entry --side south --width 914
add-door --room hall --side south --width 1.6m --variant sliding
add-door --room garage --side south --variant garage
add-door --room pantry --side east --variant pocket
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

## Scope

**v1** draws architecture in plan view: walls, openings, derived rooms, room labels,
dimensions, grid snapping, undo/redo, save and load.

**Later** turns the camera and adds disciplines: 3D view, electrical devices and
circuits, plumbing, furniture, PDF underlay, export.

The v1 document schema already carries levels, hosts, disciplines and schema
migrations, even though v1 uses almost none of it. Those cannot be retrofitted — the
rest can.

## Layout

```
packages/core       Zod document schema, versioning and migrations, host system
packages/geometry   wall graph, face detection, snapping, hit-testing — no three.js
packages/commands   command registry and CLI parser — depends only on core
apps/editor         Vite + React + react-three-fiber
apps/mcp            MCP server and CLI binary
```

`core`, `geometry` and `commands` are pure TypeScript with no DOM and no renderer. They
hold most of the logic and all of the interesting tests.

See [TECHNOLOGY.md](TECHNOLOGY.md) for what each layer is built with and why.

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
and watch the tab. The agent gets the full command reference in the tool
description, so it needs no other instructions.

**Without an agent**, the same commands work from a terminal against the same tab:

```bash
node apps/mcp/dist/cli.js --help
node apps/mcp/dist/cli.js floor-shape --kind l --width 12m --depth 9m \
  --notch-width 4m --notch-depth 3m --name dům
node apps/mcp/dist/cli.js add-room --name kuchyň --from dům --side west --width 3.6m
node apps/mcp/dist/cli.js describe --room kuchyň
node apps/mcp/dist/cli.js --picture /tmp/kuchyň.jpg measure --room kuchyň
node apps/mcp/dist/cli.js get-plan
```
