import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { expect, test } from 'vitest'
import { askPlan, runScript } from './run'
import type { RoomReport, SideReport } from './survey'

/** The doors, or the windows, of a room: one list of openings, told apart by kind. */
const doorsOf = (room: RoomReport) => room.openings.filter((it) => it.kind === 'door')
const windowsOf = (room: RoomReport) => room.openings.filter((it) => it.kind === 'window')

/** The run of a side that a wall belongs to: what `sides` says about that wall. */
const sideHolding = (room: RoomReport, wall: string): SideReport =>
  room.sides.find((side) => side.walls.some((it) => it.id === wall))!

/**
 * Rooms that are not rectangles, and the walls of them that a side alone
 * cannot name: an L has two north walls, and the inner one has to be
 * reachable by id — for a door, a window, a thing against it, a tape on it.
 */

const level = (doc: HouseDocument) => Object.keys(doc.levels)[0]!
const named = (doc: HouseDocument, name: string) =>
  roomsOf(doc, level(doc)).find((room) => room.name === name)
const report = (doc: HouseDocument, name: string) =>
  askPlan(doc, `get-plan --room "${name}"`).rooms[0]!

const RECT = 'add-room --material natural-oak --shape rectangle --width 12m --depth 9m --name dům'
const L_FLOOR =
  'add-room --material natural-oak --shape l --width 12m --depth 9m --notch-width 4m --notch-depth 3m --name dům'

test('an L has six walls, two of them on one side, told apart by number and id', () => {
  const doc = runScript(createEmptyDocument(), L_FLOOR)
  const walls = report(doc, 'dům').walls

  expect(walls).toHaveLength(6)
  expect(walls.every((wall) => /^w\d+$/.test(wall.id))).toBe(true)
  const doubled = walls.filter((wall) => wall.nth !== undefined)
  expect(doubled).toHaveLength(4)
  const sides = new Set(doubled.map((wall) => wall.side))
  expect(sides.size).toBe(2)
  for (const side of sides) {
    const numbers = doubled.filter((wall) => wall.side === side).map((wall) => wall.nth)
    expect([...numbers].sort()).toEqual([1, 2])
  }
})

test('a door goes into the inner wall of an L by its id, and describe says so', () => {
  const doc = runScript(createEmptyDocument(), L_FLOOR)
  const walls = report(doc, 'dům').walls
  const inner = walls.find((wall) => wall.nth !== undefined && wall.length === 3000)!

  const next = runScript(doc, `add-opening --kind door --room dům --wall ${inner.id}`)
  const doors = doorsOf(report(next, 'dům'))

  expect(doors).toHaveLength(1)
  expect(doors[0]!.wall).toBe(inner.id)
  expect(doors[0]!.side).toBe(inner.side)
})

test('a thing stands against the inner wall of an L by its id', () => {
  const doc = runScript(createEmptyDocument(), L_FLOOR)
  const walls = report(doc, 'dům').walls
  const inner = walls.find((wall) => wall.nth !== undefined && wall.length === 3000)!

  const next = runScript(doc, `add-object --room dům --type bookshelf --wall ${inner.id}`)
  const shelf = report(next, 'dům').objects[0]!

  expect(shelf.against).toBe(inner.side)
  expect(shelf.wall).toBe(inner.id)
  const tape = sideHolding(report(next, 'dům'), inner.id)
  expect(tape.walls.map((it) => it.id)).toContain(inner.id)
  expect(tape.objects.map((it) => it.id)).toEqual([shelf.id])
})

test('a room can be any shape, said by its corners, and the areas still add up', () => {
  const doc = runScript(createEmptyDocument(), RECT)
  const whole = named(doc, 'dům')!.area

  const next = runScript(
    doc,
    'add-room --name kuchyň --material natural-oak --points "0,0; 5m,0; 5m,3m; 3m,3m; 3m,5m; 0,5m"',
  )

  expect(roomsOf(next, level(next))).toHaveLength(2)
  expect(named(next, 'kuchyň')?.area).toBe(5000 * 3000 + 3000 * 2000)
  expect(named(next, 'dům')?.area).toBe(whole - (5000 * 3000 + 3000 * 2000))
  expect(report(next, 'kuchyň').walls).toHaveLength(6)
})

test('a room can be walked round from a side of the room it comes out of', () => {
  const doc = runScript(createEmptyDocument(), RECT)

  const next = runScript(
    doc,
    'add-room --name spíž --material natural-oak --from dům --side north --along 0 --walk "3m s, 4m e, 3m n"',
  )

  expect(roomsOf(next, level(next))).toHaveLength(2)
  expect(named(next, 'spíž')?.area).toBe(4000 * 3000)
  expect(named(next, 'dům')?.area).toBe(12_000 * 9000 - 4000 * 3000)
})

test('along takes a length as well as a fraction', () => {
  const doc = runScript(createEmptyDocument(), RECT)

  const next = runScript(
    doc,
    [
      'add-opening --kind window --room dům --side south --along 2.4m',
      'add-opening --kind window --room dům --side south --along -1m',
    ].join('\n'),
  )
  const windows = windowsOf(report(next, 'dům'))

  expect(windows).toHaveLength(2)
  // 2.4 m from the west end of a run that starts 150 mm in from the corner.
  expect(windows[0]!.along * (12_000 - 300)).toBeCloseTo(2400, -1)
  expect(windows[1]!.along).toBeGreaterThan(0.9)
})

test('everything has an id, and a thing is reached by it', () => {
  const doc = runScript(
    createEmptyDocument(),
    [RECT, 'add-object --room dům --type sofa-3 --against south'].join('\n'),
  )
  const room = report(doc, 'dům')
  const sofa = room.objects[0]!

  expect(room.id).toMatch(/^r\d+$/)
  expect(sofa.id).toMatch(/^f\d+$/)
  const next = runScript(doc, `update-object --id ${sofa.id} --against north`)
  expect(report(next, 'dům').objects[0]!.against).toBe('north')
  const gone = runScript(next, `remove-object --id ${sofa.id}`)
  expect(report(gone, 'dům').objects).toHaveLength(0)
})

/** A node sitting inside a wall rather than at its end: a graph gone wrong. */
function overlapping(doc: HouseDocument): string[] {
  const bad: string[] = []
  for (const wall of Object.values(doc.walls)) {
    const a = doc.nodes[wall.a]!
    const b = doc.nodes[wall.b]!
    for (const node of Object.values(doc.nodes)) {
      if (node.id === wall.a || node.id === wall.b) continue
      const cross = (b.x - a.x) * (node.y - a.y) - (b.y - a.y) * (node.x - a.x)
      const dot = (node.x - a.x) * (b.x - a.x) + (node.y - a.y) * (b.y - a.y)
      const inside = cross === 0 && dot > 0 && dot < (b.x - a.x) ** 2 + (b.y - a.y) ** 2
      if (inside) bad.push(`${node.id} inside ${wall.id}`)
    }
  }
  return bad
}

test('a box cut the whole depth of an arm lands on the wall that is there, and draws no second one', () => {
  const doc = runScript(
    createEmptyDocument(),
    [RECT, 'add-room --name hall --material tile-white --points "0,0; 8m,0; 8m,3m; 0,3m"'].join(
      '\n',
    ),
  )

  const next = runScript(
    doc,
    'add-room --name bed --material natural-oak --from dům --corner north-west --width 3m --depth 6m',
  )

  expect(overlapping(next)).toEqual([])
  expect(named(next, 'bed')?.area).toBe(3000 * 6000)
  expect(named(next, 'hall')?.area).toBe(8000 * 3000)
  expect(named(next, 'dům')?.area).toBe(12_000 * 9000 - 3000 * 6000 - 8000 * 3000)
  // The house borders 5 m of the hall's north wall, and that is the wall it lists.
  const south = report(next, 'dům').walls.filter((wall) => wall.side === 'south')
  expect(south.map((wall) => wall.length).sort()).toEqual([4000, 5000])
})

test('a wall named narrows along to that wall, and the tape to it', () => {
  // The hall's east wall is split by a partition landing on it from the hall's
  // side, so the house's west side is two walls in line: one run.
  const doc = runScript(
    createEmptyDocument(),
    [
      RECT,
      'add-room --name hall --material tile-white --from dům --side west --width 4m',
      'add-room --name pantry --material tile-white --from hall --side north --width 1.5m',
    ].join('\n'),
  )
  const west = report(doc, 'dům').walls.filter((wall) => wall.side === 'west')
  expect(west).toHaveLength(2)
  const upper = west.reduce((best, next) => (next.length < best.length ? next : best))

  const next = runScript(doc, `add-opening --kind window --room dům --wall ${upper.id} --along 0.5`)
  const window_ = report(next, 'dům').openings.find((it) => it.kind === 'window')!
  expect(window_.wall).toBe(upper.id)
  expect(window_.along).toBeGreaterThan(0.85)

  // The run spans both west walls, but each carries its own stretch of it — so
  // --wall w9 has somewhere to be placed along without the run being cut up.
  const tape = sideHolding(report(next, 'dům'), upper.id)
  const own = tape.walls.find((it) => it.id === upper.id)!
  expect(own.to - own.from).toBeLessThan(1500)
  expect(tape.openings.map((it) => it.id)).toEqual([window_.id])
  const centre = (own.from + own.to) / 2
  expect(tape.openings[0]!.from).toBeLessThan(centre)
  expect(tape.openings[0]!.to).toBeGreaterThan(centre)
})

test('check-plan believes a thing on the inner wall of an L', () => {
  const doc = runScript(createEmptyDocument(), L_FLOOR)
  const inner = report(doc, 'dům').walls.find(
    (wall) => wall.nth !== undefined && wall.length === 3000,
  )!
  const next = runScript(doc, `add-object --room dům --type bookshelf --wall ${inner.id}`)

  const answer = askPlan(next, 'get-plan')
  expect(answer.problems.filter((it) => it.code === 'object.misplaced')).toEqual([])
})

test('a strip off the north is said by its depth, and a floor with a width and a depth is a rectangle', () => {
  const doc = runScript(
    createEmptyDocument(),
    [
      'add-room --material natural-oak --width 12m --depth 9m --name dům',
      'add-room --name hall --material tile-white --from dům --side north --depth 2m',
    ].join('\n'),
  )
  expect(named(doc, 'hall')?.area).toBe(12_000 * 2000)
})
