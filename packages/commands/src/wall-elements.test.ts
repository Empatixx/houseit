import { createEmptyDocument, type HouseDocument, parseDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { wallElement } from '@houseit/geometry/wall-elements'
import { expect, test } from 'vitest'
import { askPlan } from './answer'
import { runScript } from './run'

const wall = (x1: number, y1: number, x2: number, y2: number, extra = '') =>
  `add-wall --from '{"x":${x1},"y":${y1}}' --to '{"x":${x2},"y":${y2}}' ${extra}`
const levelOf = (doc: HouseDocument) => Object.keys(doc.levels)[0]!
const position = (doc: HouseDocument, id: string) => {
  const o = doc.openings[id]!,
    w = doc.walls[o.wall]!,
    a = doc.nodes[w.a]!,
    b = doc.nodes[w.b]!
  return { x: a.x + (b.x - a.x) * o.t, y: a.y + (b.y - a.y) * o.t }
}
const shell = () =>
  runScript(
    createEmptyDocument(),
    [
      wall(0, 0, 6000, 0),
      wall(6000, 0, 6000, 5000),
      wall(6000, 5000, 0, 5000),
      wall(0, 5000, 0, 0),
    ].join('\n'),
  )

test('independent walls are read back before any room exists', () => {
  const doc = runScript(createEmptyDocument(), wall(0, 0, 6000, 0))
  const report = askPlan(doc, 'get-plan')
  expect(report.rooms).toEqual([])
  expect(report.walls).toMatchObject([
    { id: 'w1', from: { x: 0, y: 0 }, to: { x: 6000, y: 0 }, length: 6000 },
  ])
})

test('closing independent walls derives rooms without requiring room records', () => {
  const doc = shell()
  expect(Object.keys(doc.rooms)).toHaveLength(0)
  expect(roomsOf(doc, levelOf(doc))).toHaveLength(1)
  expect(askPlan(doc, 'get-plan').unassigned).toHaveLength(1)
})

test('a junction keeps the original whole-wall identity and rehosts its opening', () => {
  let doc = runScript(createEmptyDocument(), wall(0, 0, 6000, 0))
  doc = runScript(doc, 'add-opening --wall w1 --kind window --along 4500 --width 1200')
  doc = runScript(doc, wall(3000, 0, 3000, 4000))
  expect(wallElement(doc, 'w1').segments).toHaveLength(2)
  expect(position(doc, 'o1')).toEqual({ x: 4500, y: 0 })
  expect(askPlan(doc, 'get-plan').walls).toHaveLength(2)
  expect(parseDocument(JSON.parse(JSON.stringify(doc)))).toEqual(doc)
})

test('moving a split wall carries its window and stretches the attached partition and door', () => {
  let doc = runScript(shell(), 'add-opening --wall w3 --kind window --along 1500 --width 1200')
  doc = runScript(doc, wall(3000, 0, 3000, 5000))
  const partition = askPlan(doc, 'get-plan').walls.find(
    (w) => w.from.x === 3000 && w.to.x === 3000,
  )!
  doc = runScript(doc, `add-opening --wall ${partition.id} --kind door --along 2000`)
  const next = runScript(doc, 'update-wall --id w3 --by -300')
  expect(position(next, 'o1')).toEqual({ x: 4500, y: 5300 })
  expect(position(next, 'o2').x).toBe(3000)
  expect(position(next, 'o2').y).toBeCloseTo(2000, 6)
  expect(wallElement(next, partition.id).length).toBe(5300)
  expect(roomsOf(next, levelOf(next))).toHaveLength(2)
  expect(position(doc, 'o1')).toEqual({ x: 4500, y: 5000 })
})

test('a partition can slide along its parent wall without splitting the parent element identity', () => {
  let doc = runScript(createEmptyDocument(), wall(0, 0, 6000, 0))
  doc = runScript(doc, wall(3000, 0, 3000, 4000))
  const part = askPlan(doc, 'get-plan').walls.find((w) => w.id !== 'w1')!
  doc = runScript(doc, `update-wall --id ${part.id} --by 500`)
  expect(wallElement(doc, 'w1').length).toBe(6000)
  expect(wallElement(doc, part.id).from).toMatchObject({ x: 2500, y: 0 })
})

test('an opening that cannot fit after shortening refuses the complete transaction', () => {
  let doc = runScript(createEmptyDocument(), wall(0, 0, 6000, 0))
  doc = runScript(doc, wall(3000, 0, 3000, 4000))
  const part = askPlan(doc, 'get-plan').walls.find((w) => w.id !== 'w1')!
  doc = runScript(doc, `add-opening --wall ${part.id} --kind door --along 1000`)
  const before = JSON.stringify(doc)
  expect(() =>
    runScript(doc, 'update-wall --id w1 --thickness 250\nupdate-wall --id w1 --by 3500'),
  ).toThrow(/Opening .* no longer fits/)
  expect(JSON.stringify(doc)).toBe(before)
})

test('overlap, zero length, new unconnected crossings and openings through junctions are refused', () => {
  const doc = runScript(createEmptyDocument(), wall(0, 0, 6000, 0))
  expect(() => runScript(doc, wall(3000, 0, 7000, 0))).toThrow(/overlap/)
  expect(() => runScript(doc, wall(1, 1, 1, 1))).toThrow(/at least/)
  const withOther = runScript(doc, wall(3000, 500, 3000, 4000))
  expect(() => runScript(withOther, 'update-wall --id w1 --by 1000')).toThrow(/cross without/)
  const junction = runScript(doc, wall(3000, 0, 3000, 4000))
  expect(() => runScript(junction, 'add-opening --wall w1 --kind window --along 3000')).toThrow(
    /between wall junctions/,
  )
})

test('opening CRUD works on an isolated wall, including rehosting onto another wall', () => {
  let doc = runScript(createEmptyDocument(), wall(0, 0, 6000, 0))
  doc = runScript(doc, wall(0, 4000, 6000, 4000))
  doc = runScript(doc, 'add-opening --wall w1 --kind door --along 2000 --towards right')
  doc = runScript(
    doc,
    'update-opening --id o1 --to-wall w2 --along 3500 --width 900 --towards left',
  )
  expect(position(doc, 'o1')).toEqual({ x: 3500, y: 4000 })
  expect(doc.openings.o1).toMatchObject({ wall: 'w2', width: 900, swing: 1 })
  doc = runScript(doc, 'remove-opening --id o1')
  expect(doc.openings).toEqual({})
})

test('wall height edits retain valid openings and reject clipping them', () => {
  const doc = runScript(
    createEmptyDocument(),
    `${wall(0, 0, 6000, 0)}\nadd-opening --wall w1 --kind window`,
  )
  expect(() => runScript(doc, 'update-wall --id w1 --height 2000')).toThrow(/wall height/)
  const next = runScript(doc, 'update-wall --id w1 --thickness 300 --height 2500')
  expect(next.walls.w1).toMatchObject({ thickness: 300, height: 2500 })
})

test('diagonal independent walls move perpendicular to their own direction', () => {
  const doc = runScript(createEmptyDocument(), wall(0, 0, 3000, 4000))
  const next = runScript(doc, 'update-wall --id w1 --by 500')
  expect(wallElement(next, 'w1').from).toMatchObject({ x: -400, y: 300 })
  expect(wallElement(next, 'w1').to).toMatchObject({ x: 2600, y: 4300 })
})

test('an upper-floor wall respects the open level and keeps lower-floor nodes separate', () => {
  let doc = runScript(createEmptyDocument(), wall(0, 0, 6000, 0))
  doc = runScript(doc, 'add-level --name Upper')
  const upper = Object.values(doc.levels).find((l) => l.name === 'Upper')!.id
  doc = runScript(doc, wall(0, 0, 6000, 0), upper)
  const reported = askPlan(doc, 'get-plan', upper)
  expect(reported.walls).toHaveLength(1)
  expect(reported.walls[0]!.level).toBe(upper)
  expect(Object.keys(doc.nodes)).toHaveLength(4)
})

test('an existing closed space can be named and furnished without adding walls', () => {
  const before = shell()
  const doc = runScript(
    before,
    `add-room --at '{"x":2000,"y":2000}' --name Living --material natural-oak`,
  )
  expect(doc.walls).toEqual(before.walls)
  expect(askPlan(doc, 'get-plan').rooms[0]).toMatchObject({ name: 'Living' })
  const moved = runScript(doc, 'update-wall --id w3 --by -300')
  expect(Object.keys(moved.rooms)).toEqual(Object.keys(doc.rooms))
  expect(Object.values(moved.rooms)[0]!.name).toBe('Living')
})

test('an entrance in an unnamed derived room is recognised', () => {
  const doc = runScript(shell(), 'add-opening --wall w1 --kind door --along 1500')
  expect(askPlan(doc, 'get-plan').problems.some((p) => p.code === 'house.no-entrance')).toBe(false)
})

test('removing an independent partition merges derived rooms and removes its openings', () => {
  let doc = runScript(shell(), wall(3000, 0, 3000, 5000))
  const partition = askPlan(doc, 'get-plan').walls.find(
    (w) => w.from.x === 3000 && w.to.x === 3000,
  )!
  doc = runScript(doc, `add-opening --wall ${partition.id} --kind door --along 2000`)
  doc = runScript(doc, `remove-wall --id ${partition.id}`)
  expect(roomsOf(doc, levelOf(doc))).toHaveLength(1)
  expect(doc.openings).toEqual({})
  expect(askPlan(doc, 'get-plan').walls).toHaveLength(4)
  expect(parseDocument(doc)).toEqual(doc)
})

test('removing a boundary removes its now-unbound empty room label', () => {
  const doc = runScript(
    shell(),
    `add-room --at '{"x":2000,"y":2000}' --name Living --material natural-oak`,
  )
  const next = runScript(doc, 'remove-wall --id w1')
  expect(next.rooms).toEqual({})
  expect(roomsOf(next, levelOf(next))).toHaveLength(0)
})
