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

## Working this way

1. `help` and `guidelines` once at the start.
2. Build in a few programs, each of which ends by returning what you need to judge it
   (areas, `ctx.problems()`), not by dumping the plan.
3. Look at the picture after each call. Fix with another program using the ids you got.
4. A thrown error discards the whole program, not part of it: decide with reads
   (`ctx.room(…).sides`, `ctx.problems()`) before you call, rather than undoing after.
