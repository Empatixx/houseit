# Working on houseit

## Everything goes through the CLI, and that is the test

An agent gets at this plan through one door: the commands in `packages/commands`,
reached over MCP. There are ten — `add-room`, `update-room`, `remove-room`,
`add-opening`, `update-opening`, `remove-opening`, `add-object`, `update-object`,
`remove-object`, `get-plan` — and every change is made the way an agent would have
to make it, never by writing to the document. If something cannot be said as a
command, that is the bug, and it is the bug to fix.

Three nouns and one question, and the shape of it is the point:

- **No noun for a wall.** Every wall is the edge of a room, so asking for the rooms
  is asking for the walls. `add-room` draws them; moving the wall between two rooms
  is `update-room --side north --by 300`. `draw-wall` and the stub commands still
  exist as modules, because the pencil and the wall drag call them — they are just
  not in the registry, so they are not words an agent has.
- **No verb for looking.** Every command answers with what it touched, those rooms
  read back in full — each wall with what opens and stands on it and the stretches
  still free — and everything now wrong with the plan. `describe`, `measure` and
  `check-plan` are gone as commands and live in `survey.ts`, `answer.ts` and
  `checks.ts`, which the answer is built from. `get-plan` is only for rooms a
  command did not touch.
- **`update` takes an id.** Every answer names what it changed, so the id of the
  sofa just placed is in the answer to placing it. There is no second way of saying
  which sofa, and so no way for the two to disagree.

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

With Chrome already up on the debugging port, that window is used — driving the one
somebody is watching is how the agent and the person see the same plan. With no such
window, one is started **headless** on the same profile, so an agent on its own needs
nothing but `bun run dev`. `scripts/chrome.sh` is for when you want to watch.

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

## The tool description never changes

`toolDescription()` in `apps/mcp/src/report.ts` is frozen prose and must stay that
way: it names no command, no object type and no floor material. A description is
part of the prompt, and a prompt that changes throws away the cache of every
conversation using it — so a new sofa in the catalogue would make every agent
everywhere start again from cold. The command list is `floorplan("help")`, which is
an answer and is cached like any other. There is a test that fails if a catalogue
word reaches the description.

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

## Checks

```bash
bun run test        # vitest through turbo; `bun test` at the root is not it
bun run typecheck && bun run lint && bun run depcruise && bun run knip
```
