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
add-room     --name kitchen --x 0 --y 0 --w 4200 --h 3600
move-wall    --id w3 --dx 250
add-opening  --wall w3 --t 0.5 --kind door --width 900
rename-room  --at 2100,1800 --name "living room"
get-plan
```

Several commands separated by newlines apply as one transaction — all of them land, or
none do.

Each command is declared once, with a Zod schema for its arguments. That single
declaration produces the CLI parser, the MCP tool description the agent reads, the
`--help` text, and the runtime validation. Adding a command means adding one file.

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
node apps/mcp/dist/cli.js get-plan
```
