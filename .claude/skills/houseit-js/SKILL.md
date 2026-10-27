---
name: houseit-js
description: Use when drawing, furnishing or generating a floor plan through the houseit `floorplan` MCP tool (or `apps/mcp/dist/cli.js`) — write one JavaScript program against `ctx` instead of many command lines, so loops, conditions and readback happen in a single call and a single transaction.
---

# Houseit programs

The `floorplan` tool takes a string. Command lines still work, but anything longer
than a few lines is better written as one program:

```js
#!js
const flat = ctx.addRoom({ name: 'byt', shape: 'rectangle', width: '9m', depth: '7m', material: 'natural-oak' })
ctx.addRoom({ name: 'koupelna', from: 'byt', corner: 'north-west', width: '2.4m', depth: '2.2m', material: 'tile-white', kind: 'bathroom' })
ctx.addOpening({ room: 'koupelna', kind: 'door', side: 'south', width: 800 })
return ctx.rooms().map((room) => [room.name, room.areaM2])
```

or as a module body: `export default (ctx) => { … }`.

## Rules

- The whole program is **one synchronous transaction**. If anything throws, nothing
  changes. No `await`, no `import`, no `window`/`fetch` — everything is on `ctx`.
- Every command is `ctx.<camelCaseName>({ options })`: `add-room --notch-width 2m` is
  `ctx.addRoom({ notchWidth: '2m' })`. Lengths are millimetres (numbers) or strings
  with a unit (`'3.6m'`). JSON options take plain objects/arrays.
- A call returns `{ id, changed, shown, at?, notes? }`; `id` is the first thing it
  made — keep it, `update-*`/`remove-*` take ids.
- Read with `ctx.rooms(level?)`, `ctx.room(name, level?)`, `ctx.problems(level?)`,
  `ctx.levels()`, `ctx.doc()` (a copy — writing to it changes nothing). A room report
  has `areaM2`, `width`, `depth`, `box`, `sides[].free` (spans still free on a side),
  `openings`, `objects`, `neighbours`.
- More reads: `ctx.objects(level?)` (every thing with its room), `ctx.wall(id)` (segments with
  ends, length, thickness, openings), `ctx.constraints()`. `ctx.brief()` shortens the answer to
  rooms, their openings and things, problems and rules — use it once the plan is large.
- The plan's conventions: millimetres, x east and y north, so north is the top of every
  picture. Outside walls are 300 mm and inner ones 150 mm unless a thickness is given; a
  room's width and depth are measured inside its walls. `along` on a side is where the middle
  of the thing stands, a fraction from the west or south end or a length from it. A problem
  carries `ids` (for a door: the door, then what is in its way) — act on those.
- `ctx.useLevel('1. patro')` moves later calls to that storey. `ctx.run('add-room …')`
  runs command lines as written. `ctx.log(…)` comes back as `logs`, the return value
  as `result`, followed by the usual answer and a picture.
- Signatures: call the tool with `help` once (commands, then every `ctx.*` signature),
  or `return ctx.help('add-object')` for one. `guidelines` explains how a dwelling
  goes together — read it before laying out a home.

- `ctx.addConstraint({ kind: 'fixed', room: 'kuchyň', measure: 'width' })` keeps a size
  through later edits; `equal` (with `other`) and `parallel` (`wall`, `other`) too. Every
  answer lists the rules with what they measure now; an edit that breaks one is refused.

## A home, start to finish

Build in this order, one program per step, and look at the picture between steps:

1. The outline at the size the brief and `guidelines` call for.
2. Rooms cut out of it: wet rooms together, habitable rooms on the facade. What is
   left of the outline keeps its name: `ctx.updateRoom({ room: 'dům', name: 'chodba',
   kind: 'hall' })` turns it into the hall rather than cutting a hall as well.
3. Doors (`opensInto` where the default side is wrong), then windows.
4. Stairs, then the next storey (below).
5. Furniture, room by room (below), until `ctx.problems()` is empty.

Give rooms a `kind` when the name does not say it (`pokoj` could be anything):
the checks ask a bedroom for a bed and a living room for seating by kind.

## Storeys and stairs

```js
#!js
// ground floor: the flight stands in the hall. A straight flight is about 900 x 4200,
// so lay it along a long wall (rotation 90 turns it to run along the side).
ctx.addObject({ room: 'chodba', type: 'stairs-straight', against: 'south', rotation: 90 })
ctx.addLevel({ name: '1. patro' }) // takes the height of the storey below; set 3 m on the ground floor first
ctx.useLevel('1. patro')
ctx.addRoom({ name: 'patro', shape: 'rectangle', width: '10m', depth: '8m', material: 'natural-oak' })
// the flight cuts its well in the floor above: read it, and draw the upper hall round it
const well = ctx.room('patro').wells[0].box
const m = 1000
ctx.addRoom({ name: 'chodba patro', from: 'patro', kind: 'hall', material: 'natural-oak',
  points: `${well.x0 - m},${well.y0 - m}; ${well.x1 + m},${well.y0 - m}; ${well.x1 + m},${well.y1 + m}; ${well.x0 - m},${well.y1 + m}` })
return ctx.problems()
```

A house starts with `ctx.updateLevel({ height: '3m' })`: the default 2.8 m storey leaves
2.55 m clear, under the 2.6 m a habitable room needs. `guidelines` lists every flight's
footprint at 2.8 and 3 m; size the hall to it before cutting the rooms round it. The
upper outline lands on the ground floor's footprint when it has the same size.
Clip the hall's points to the outline when the well is near a facade. `stairs-u` and
`stairs-l-landing` fit a squarer hall. A room name is looked for on every storey;
`useLevel` only decides where new rooms go.

## Furnishing

`guidelines` lists what every kind of room holds, the clear floor each thing needs in
front of or beside it, and how each room is laid out (the kitchen run first). The checks
hold the plan to it: `room.unfurnished` names what a room still lacks,
`object.no-room-to-use` names what blocks a wardrobe's doors or a bed's side,
`object.faces-wall` a sofa or screen turned to the wall, `door.onto-stairs` a door with no
landing before a flight,
`kitchen.incomplete` / `kitchen.fridge-far` the run, `flat.table-short` the seats and
`flat.no-washer` the washing machine. A room with only a bed in it is not finished.

Every thing in an answer says what it `faces`: `"north, towards the media unit f9 2300
mm ahead"`, or `"south, towards the wall 0 mm ahead"` for a sofa put in backwards. Every
door says what is `ahead` on each side, `["in obývák: open floor for 5 m or more", "in
chodba: the straight staircase f2 0 mm ahead"]`. Read both after placing a thing:
seating and screens face each other across the room, a desk may face the wall, and
nothing a door opens onto should be closer than a landing. The picture after one thing
is placed selects it, with an arrow off its front edge.

Place things on the free stretches the report gives, not by guessing fractions:

```js
#!js
// stretches of wall still free in a room, longest first, optionally avoiding some sides
const stretches = (name, avoid = []) =>
  ctx.room(name).sides
    .filter((side) => !avoid.includes(side.side))
    .flatMap((side) => side.free.map((span) => ({ side: side.side, from: span.from, to: span.to, length: span.to - span.from })))
    .sort((a, b) => b.length - a.length)
const put = (room, type, run, extra = {}) =>
  ctx.addObject({ room, type, against: run.side, along: Math.round((run.from + run.to) / 2), ...extra })

// a kitchen: the fridge at one end of the longest door-free wall, the run fitted to the rest
const wall = stretches('kuchyň')[0]
ctx.addObject({ room: 'kuchyň', type: 'refrigerator', against: wall.side, along: wall.from + 400 })
const rest = stretches('kuchyň').find((run) => run.side === wall.side)
put('kuchyň', 'kitchen-i', rest, { width: Math.min(rest.length - 50, 4200) })

// a bedroom: bed head on a wall without the window, wardrobe on another, nightstands
const windowed = ctx.room('ložnice').sides
  .filter((side) => side.openings.some((o) => o.kind === 'window'))
  .map((side) => side.side)
const head = stretches('ložnice', windowed)[0]
const bed = put('ložnice', 'queen-bed', head)
put('ložnice', 'wardrobe', stretches('ložnice', [head.side])[0])
return ctx.problems().filter((p) => p.room === 'ložnice' || p.room === 'kuchyň')
```

Against a side, `along` is where the thing's middle stands: a fraction from the west or
south end, or a whole number of millimetres, the same scale as `free`. A thing standing
free (no `against`) takes `along` and `across` as fractions of the room's width, west to
east, and depth, south to north. `help` lists every type with its width × depth, so check
that it fits the stretch before you place it. Read `sides` again after each placement, since things take their stretch.
Size a thing to its room. A kitchen run takes `width` to fill its wall (`kitchen-i`
along one wall, `kitchen-l` into a corner of a squarer room, `kitchen-u` round a room
2.4 m across or more); a child's room a `twin-bed`, a master bedroom a
`queen-bed` or `king-bed`. Every catalogue type has a real size; `help add-object` lists
them, and a thing that does not fit is refused with the reason.

## The roof

`ctx.addRoof({ shape: 'gable' | 'hip' | 'shed' | 'flat', pitch: 35, overhang: '500mm',
ridge: 'east-west', covering: 'roof-tiles', walls: '#ecebe6' })` roofs the top storey over
its whole outline. An L or T house gets a roof over each wing, its ridge running into the
main one; a wing as wide as the house becomes a lean-to. Coverings: `roof-tiles`,
`roof-tiles-anthracite`, `standing-seam`, `slate`, `shingles`. Gables are walled in the
`walls` colour, the eaves carry a fascia and a gutter. Adding a roof replaces the
storey's roof; `ctx.removeRoof()` takes it off. Pick the roof with the house: a gable for
a plain house, a hip for a squat one, a shed or flat roof for a modern cube.

## The facade and the look of the house

`ctx.updateHouse({ style: 'classic' })` gives the whole house a roof and a facade in one go
(`classic`, `villa`, `modern`, `scandinavian`, `rustic`, `industrial`). Refine it with
`ctx.updateFacade({ material, side?, level?, from?, to?, colour? })`: materials
`render-white`, `render-grey`, `larch-horizontal`, `larch-vertical`, `charred-wood`,
`brick-red`, `brick-white`, `stone`, `cement-panels`, `concrete`. Without more it covers
every exterior wall; `side` keeps to the walls facing that way, `from`/`to` (mm above the
storey floor) lay a band such as a stone plinth (`from: 0, to: 450`), and `colour` tints a
render.

## The garden

The plot is a room like any other, of kind `lawn`, drawn first; the house is cut out of
it, and trees stand in it as things from the catalogue:

```js
#!js
ctx.addRoom({ name: 'zahrada', shape: 'rectangle', width: '26m', depth: '22m', material: 'grass', kind: 'lawn' })
ctx.addRoom({ name: 'dům', from: 'zahrada', corner: 'north-west', width: '11m', depth: '8m', material: 'natural-oak', thickness: 300 })
ctx.addObject({ room: 'zahrada', type: 'tree-deciduous', along: 0.2, across: 0.25 })
ctx.addObject({ room: 'zahrada', type: 'tree-spruce', along: 0.9, across: 0.85 })
ctx.addObject({ room: 'zahrada', type: 'hedge', against: 'north', width: 8000 })
ctx.addFence({ kind: 'slats', around: 'parcel' })   // or around: '6m', or points
return ctx.problems()
```

Garden things: `tree-deciduous`, `tree-birch`, `tree-spruce`, `shrub-round`,
`shrub-hydrangea`, `hedge`, `grass-ornamental`; in a pond `water-lilies`, `fish-koi`.
Fences: `boards`, `slats`, `mesh`, `bars`, `gabion`, `wall`; a fence's gate lands opposite
the front door, or `gates: [{ at, width, kind }]` places them. Every answer carries
`fences` with their length.

## Working this way

1. `help` and `guidelines` once at the start.
2. Build in a few programs, each of which ends by returning what you need to judge it
   (areas, `ctx.problems()`), not by dumping the plan.
3. Look at the picture after each call. Fix with another program using the ids you got.
4. A thrown error discards the whole program, not part of it: decide with reads
   (`ctx.room(…).sides`, `ctx.problems()`) before you call, rather than undoing after.
   A call whose error you catch leaves nothing of itself behind, so trying a few spots
   in a `try` is safe, but reading `free` first is cheaper.
5. Done means every room furnished for living in and `ctx.problems()` empty on every
   storey: `ctx.levels()` then `ctx.problems(level)` for each.
