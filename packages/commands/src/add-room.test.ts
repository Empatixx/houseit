import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { expect, test } from 'vitest'
import { runScript } from './run'

const FLOOR =
  'floor-shape --material natural-oak --kind rectangle --width 12m --depth 9m --name dům'

const floor = () => {
  const doc = createEmptyDocument()
  const level = Object.keys(doc.levels)[0]!
  return { doc: runScript(doc, FLOOR), level }
}

const named = (doc: ReturnType<typeof floor>['doc'], level: string, name: string) =>
  roomsOf(doc, level).find((room) => room.name === name)

test('cutting a room off one side leaves two rooms', () => {
  const { doc, level } = floor()

  const next = runScript(
    doc,
    'add-room --material natural-oak --name kuchyň --from dům --side west --width 3.6m',
  )

  expect(roomsOf(next, level)).toHaveLength(2)
})

test('the two rooms share the partition, so their areas still add up to the whole floor', () => {
  const { doc, level } = floor()

  const next = runScript(
    doc,
    'add-room --material natural-oak --name kuchyň --from dům --side west --width 3.6m',
  )
  const total = roomsOf(next, level).reduce((sum, room) => sum + room.area, 0)

  expect(total).toBe(12_000 * 9000)
})

test('the new room is as wide as asked, measured from the side it was cut from', () => {
  const { doc, level } = floor()

  const next = runScript(
    doc,
    'add-room --material natural-oak --name kuchyň --from dům --side west --width 3.6m',
  )

  expect(named(next, level, 'kuchyň')?.area).toBe(3600 * 9000)
})

test('the remainder keeps the name it had', () => {
  const { doc, level } = floor()

  const next = runScript(
    doc,
    'add-room --material natural-oak --name kuchyň --from dům --side west --width 3.6m',
  )

  expect(named(next, level, 'dům')?.area).toBe(8400 * 9000)
})

test('every side of the compass works', () => {
  for (const side of ['north', 'south', 'east', 'west']) {
    const { doc, level } = floor()

    const next = runScript(
      doc,
      `add-room --material natural-oak --name pokoj --from dům --side ${side} --width 3m`,
    )
    const room = named(next, level, 'pokoj')

    expect(room?.area).toBe(side === 'north' || side === 'south' ? 12_000 * 3000 : 3000 * 9000)
  }
})

test('rooms can be cut out of rooms that were themselves cut', () => {
  const { doc, level } = floor()

  const next = runScript(
    doc,
    [
      'add-room --material natural-oak --name kuchyň --from dům --side west --width 3.6m',
      'add-room --material natural-oak --name koupelna --from dům --side north --width 2.4m',
    ].join('\n'),
  )

  expect(roomsOf(next, level)).toHaveLength(3)
  expect(named(next, level, 'koupelna')?.area).toBe(8400 * 2400)
})

test('a room wider than what it is cut from is refused', () => {
  const { doc } = floor()

  expect(() =>
    runScript(doc, 'add-room --material natural-oak --name x --from dům --side west --width 20m'),
  ).toThrow(/wide|width/i)
})

test('cutting from a room that does not exist says so', () => {
  const { doc } = floor()

  expect(() =>
    runScript(doc, 'add-room --material natural-oak --name x --from garáž --side west --width 2m'),
  ).toThrow(/garáž/)
})

const L_FLOOR =
  'floor-shape --material natural-oak --kind l --width 12m --depth 9m --notch-width 4m --notch-depth 3m --name dům'

const lFloor = () => {
  const doc = createEmptyDocument()
  const level = Object.keys(doc.levels)[0]!
  return { doc: runScript(doc, L_FLOOR), level }
}

test('cutting off a stepped side is refused rather than left with a tail', () => {
  const { doc } = lFloor()

  expect(() =>
    runScript(
      doc,
      'add-room --material natural-oak --name ložnice --from dům --side north --width 3.4m',
    ),
  ).toThrow(/north side of dům/)
})

test('a straight side of a non-rectangular room can still be cut', () => {
  const { doc, level } = lFloor()

  const next = runScript(
    doc,
    'add-room --material natural-oak --name spíž --from dům --side east --width 3m',
  )

  expect(named(next, level, 'spíž')?.area).toBe(3000 * 6000)
})

const CORNER =
  'add-room --material natural-oak --name kuchyň --from dům --corner north-west --width 4m --depth 3m'

test('cutting a corner leaves the rest of the room L-shaped', () => {
  const { doc, level } = floor()

  const next = runScript(doc, CORNER)
  const rest = named(next, level, 'dům')!

  expect(named(next, level, 'kuchyň')?.area).toBe(4000 * 3000)
  expect(rest.area).toBe(12_000 * 9000 - 4000 * 3000)
  // Six corners, which is what tells an L from a rectangle.
  expect(new Set(rest.nodes).size).toBe(6)
})

test('the two rooms share their partition, so the areas still add up', () => {
  const { doc, level } = floor()

  const total = roomsOf(runScript(doc, CORNER), level).reduce((sum, room) => sum + room.area, 0)

  expect(total).toBe(12_000 * 9000)
})

test('each corner of the compass works', () => {
  for (const corner of ['north-west', 'north-east', 'south-west', 'south-east']) {
    const { doc, level } = floor()

    const next = runScript(
      doc,
      `add-room --material natural-oak --name kout --from dům --corner ${corner} --width 4m --depth 3m`,
    )

    expect(named(next, level, 'kout')?.area, corner).toBe(4000 * 3000)
  }
})

test('a corner cut needs a depth as well as a width', () => {
  const { doc } = floor()

  expect(() =>
    runScript(
      doc,
      'add-room --material natural-oak --name kuchyň --from dům --corner north-west --width 4m',
    ),
  ).toThrow(/depth/)
})

test('a side and a corner cannot both be asked for', () => {
  const { doc } = floor()

  expect(() =>
    runScript(
      doc,
      'add-room --material natural-oak --name k --from dům --side north --corner north-west --width 2m --depth 2m',
    ),
  ).toThrow(/side|corner/)
})

test('a corner bigger than the room it is cut from is refused', () => {
  const { doc } = floor()

  expect(() =>
    runScript(
      doc,
      'add-room --material natural-oak --name k --from dům --corner north-west --width 20m --depth 3m',
    ),
  ).toThrow(/wider|deeper/)
})

test('the same corner cannot be taken twice: the second cut would hang in the air', () => {
  const { doc } = floor()

  const l = runScript(doc, CORNER)

  expect(() =>
    runScript(
      l,
      'add-room --material natural-oak --name k --from dům --corner north-west --width 2m --depth 2m',
    ),
  ).toThrow(/corner/i)
})

test('the other corners of an L are still corners', () => {
  const { doc, level } = floor()

  const next = runScript(
    doc,
    [
      CORNER,
      'add-room --material natural-oak --name koupelna --from dům --corner south-east --width 3m --depth 2m',
    ].join('\n'),
  )

  expect(named(next, level, 'koupelna')?.area).toBe(3000 * 2000)
  expect(roomsOf(next, level)).toHaveLength(3)
})

test('a room cut into a corner can itself be L-shaped', () => {
  const { doc, level } = floor()

  const next = runScript(
    doc,
    'add-room --material natural-oak --name kuchyň --from dům --corner north-west --width 4m --depth 3m --notch-width 1.5m --notch-depth 1m',
  )
  const kitchen = named(next, level, 'kuchyň')!

  expect(kitchen.area).toBe(4000 * 3000 - 1500 * 1000)
  expect(new Set(kitchen.nodes).size).toBe(6)
})

test('an L-shaped room still shares its partition with what is left', () => {
  const { doc, level } = floor()

  const next = runScript(
    doc,
    'add-room --material natural-oak --name kuchyň --from dům --corner south-east --width 4m --depth 3m --notch-width 1.5m --notch-depth 1m',
  )
  const total = roomsOf(next, level).reduce((sum, room) => sum + room.area, 0)

  expect(total).toBe(12_000 * 9000)
  expect(roomsOf(next, level)).toHaveLength(2)
})

test('a notch needs both of its dimensions', () => {
  const { doc } = floor()

  expect(() =>
    runScript(
      doc,
      'add-room --material natural-oak --name k --from dům --corner north-west --width 4m --depth 3m --notch-width 1.5m',
    ),
  ).toThrow(/notch/i)
})

test('a notch bigger than the room it is taken out of is refused', () => {
  const { doc } = floor()

  expect(() =>
    runScript(
      doc,
      'add-room --material natural-oak --name k --from dům --corner north-west --width 4m --depth 3m --notch-width 5m --notch-depth 1m',
    ),
  ).toThrow(/notch/i)
})

const flat = (script: string[]) =>
  runScript(
    createEmptyDocument(),
    [
      'floor-shape --material natural-oak --kind rectangle --width 8m --depth 5m --name byt',
      ...script,
    ].join('\n'),
  )

/** Where an opening actually sits, which is the only thing that must not move. */
const openingAt = (doc: HouseDocument) => {
  const opening = Object.values(doc.openings)[0]!
  const wall = doc.walls[opening.wall]!
  const a = doc.nodes[wall.a]!
  const b = doc.nodes[wall.b]!
  return { x: a.x + (b.x - a.x) * opening.t, y: a.y + (b.y - a.y) * opening.t }
}

test('a window stays where it is when the wall under it is split', () => {
  const before = flat(['add-window --room byt --side south --width 1.2m'])
  const after = runScript(
    before,
    'add-room --material natural-oak --name koupelna --from byt --side west --width 2m',
  )

  expect(openingAt(after)).toEqual(openingAt(before))
})

test('and it stays no wider than the wall it ends up in', () => {
  const doc = flat([
    'add-window --room byt --side south --width 1.2m',
    'add-room --material natural-oak --name koupelna --from byt --side west --width 2m',
  ])
  const opening = Object.values(doc.openings)[0]!
  const wall = doc.walls[opening.wall]!
  const a = doc.nodes[wall.a]!
  const b = doc.nodes[wall.b]!

  expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThanOrEqual(opening.width)
})

test('a partition that would run through a window is refused', () => {
  // The window sits in the middle of the south wall; cutting four metres off the
  // west would put the new partition straight through it.
  const doc = flat(['add-window --room byt --side south --width 1.2m'])

  expect(() =>
    runScript(doc, 'add-room --material natural-oak --name kout --from byt --side west --width 4m'),
  ).toThrow(/window/)
})
