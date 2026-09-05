import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import type { Box } from './boxes'
import { swingOf } from './place-opening'
import { runScript } from './run'

const FLOOR = 'add-room --material natural-oak --shape rectangle --width 12m --depth 9m --name dům'
const CUT = 'add-room --material natural-oak --name kuchyň --from dům --side west --width 3.6m'

const floor = () => {
  const doc = createEmptyDocument()
  const level = Object.keys(doc.levels)[0]!
  return { doc: runScript(doc, FLOOR), level }
}

const openings = (doc: HouseDocument) => Object.values(doc.openings)

test('a door is an opening that reaches the floor', () => {
  const { doc } = floor()

  const next = runScript(doc, 'add-opening --kind door --room dům --side south')

  expect(openings(next)).toEqual([
    expect.objectContaining({
      kind: 'door',
      variant: 'hinged',
      width: 800,
      height: 1970,
      sillHeight: 0,
    }),
  ])
})

test('a door between two rooms goes in the wall they share', () => {
  const { doc } = floor()

  const next = runScript(doc, [CUT, 'add-opening --kind door --room kuchyň --side east'].join('\n'))
  const wall = next.walls[openings(next)[0]!.wall]!

  expect(next.nodes[wall.a]!.x).toBe(3600)
  expect(next.nodes[wall.b]!.x).toBe(3600)
})

test('a door swings into the room it was named from, so the two sides disagree', () => {
  const { doc } = floor()

  const next = runScript(
    doc,
    [
      CUT,
      'add-opening --kind door --room kuchyň --side east',
      'add-opening --kind door --room dům --side west',
    ].join('\n'),
  )
  const [fromKitchen, fromLiving] = openings(next)

  expect(fromKitchen!.wall).toBe(fromLiving!.wall)
  expect(fromKitchen!.swing).toBe(-fromLiving!.swing)
})

test('dimensions can be given', () => {
  const { doc } = floor()

  const next = runScript(
    doc,
    'add-opening --kind door --room dům --side south --width 0.9m --height 2.1m',
  )

  expect(openings(next)).toEqual([expect.objectContaining({ width: 900, height: 2100 })])
})

test('a door and a window can share a wall without overlapping', () => {
  const { doc } = floor()

  const next = runScript(
    doc,
    [
      'add-opening --kind door --room dům --side south',
      'add-opening --kind window --room dům --side south --width 2m',
    ].join('\n'),
  )
  const [door, window_] = openings(next)

  expect(door!.wall).toBe(window_!.wall)
  expect(Math.abs(door!.t - window_!.t) * 12_000).toBeGreaterThan((800 + 2000) / 2)
})

test('putting a door in a room that does not exist says so', () => {
  const { doc } = floor()

  expect(() => runScript(doc, 'add-opening --kind door --room garáž --side south')).toThrow(/garáž/)
})

test('a door is not hung behind the furniture already standing at that wall', () => {
  const { doc } = floor()

  const next = runScript(
    doc,
    [
      // Three metres of sofa across the middle of the twelve metre wall.
      'add-object --room dům --type sofa-3 --against north --width 3m',
      'add-opening --kind door --room dům --side north --width 0.9m',
    ].join('\n'),
  )
  const door = openings(next)[0]!

  // Anywhere but behind the sofa: a door you cannot walk through is not a door,
  // and nothing in the drawing would have said so.
  expect(Math.abs(door.t * 12_000 - 6000)).toBeGreaterThan(1500 + 450)
})

test('nor on the toilet in the room on the other side of that same wall', () => {
  const { doc } = floor()

  const next = runScript(
    doc,
    [
      CUT,
      // Against the wall the two rooms share, halfway along it.
      'add-object --room kuchyň --type toilet-tank --against east',
      'add-opening --kind door --room dům --side west --width 0.9m',
    ].join('\n'),
  )
  const door = openings(next).find((opening) => opening.kind === 'door')!
  const wall = next.walls[door.wall]!
  const a = next.nodes[wall.a]!
  const b = next.nodes[wall.b]!
  const at = a.y + (b.y - a.y) * door.t

  // A door has two sides and only one of them is the room it was asked for. The
  // lavatory standing against the far face is in the way just the same.
  expect(Math.abs(at - 4500)).toBeGreaterThan((900 + 380) / 2)
})

// From here on, the same wall asked for a window instead of a door.

test('a window goes into the wall on the side it was asked for', () => {
  const { doc } = floor()

  const next = runScript(doc, 'add-opening --kind window --room dům --side south')
  const [opening] = openings(next)
  const wall = next.walls[opening!.wall]!

  expect(next.nodes[wall.a]!.y).toBe(0)
  expect(next.nodes[wall.b]!.y).toBe(0)
})

test('a window with no dimensions given is a plain 1.2 m one at sill height', () => {
  const { doc } = floor()

  const next = runScript(doc, 'add-opening --kind window --room dům --side south')

  expect(openings(next)).toEqual([
    expect.objectContaining({
      kind: 'window',
      variant: 'hinged',
      width: 1200,
      height: 1500,
      sillHeight: 900,
      t: 0.5,
    }),
  ])
})

test('dimensions can be given', () => {
  const { doc } = floor()

  const next = runScript(
    doc,
    'add-opening --kind window --room dům --side north --width 2m --height 1.8m --sill 0.6m',
  )

  expect(openings(next)).toEqual([
    expect.objectContaining({ width: 2000, height: 1800, sillHeight: 600 }),
  ])
})

test('a second window on the same wall lands beside the first, not on top of it', () => {
  const { doc } = floor()

  const next = runScript(
    doc,
    [
      'add-opening --kind window --room dům --side south',
      'add-opening --kind window --room dům --side south',
    ].join('\n'),
  )
  const [first, second] = openings(next)

  expect(openings(next)).toHaveLength(2)
  expect(first!.wall).toBe(second!.wall)
  expect(Math.abs(first!.t - second!.t) * 12_000).toBeGreaterThanOrEqual(1200)
})

test('a window wider than the wall is refused', () => {
  const { doc } = floor()

  expect(() =>
    runScript(doc, 'add-opening --kind window --room dům --side south --width 20m'),
  ).toThrow(/wall/i)
})

test('a window that no longer fits beside the others is refused', () => {
  const { doc } = floor()

  expect(() =>
    runScript(
      doc,
      [
        'add-opening --kind window --room dům --side south --width 7m',
        'add-opening --kind window --room dům --side south --width 7m',
      ].join('\n'),
    ),
  ).toThrow(/room|fit/i)
})

test('windowing a room that does not exist says so', () => {
  const { doc } = floor()

  expect(() => runScript(doc, 'add-opening --kind window --room garáž --side south')).toThrow(
    /garáž/,
  )
})

test('a room cut out of another can be windowed on its own outside wall', () => {
  const { doc } = floor()

  const next = runScript(
    doc,
    'add-room --material natural-oak --name kuchyň --from dům --side west --width 3.6m',
  )

  expect(
    openings(runScript(next, 'add-opening --kind window --room kuchyň --side west')),
  ).toHaveLength(1)
})

test('a window is happy over the sofa, because that is where a sofa goes', () => {
  const { doc } = floor()

  const next = runScript(
    doc,
    [
      'add-object --room dům --type sofa-3 --against north --width 3m',
      'add-opening --kind window --room dům --side north --width 1.2m',
    ].join('\n'),
  )
  const window = Object.values(next.openings)[0]!

  // Doors keep clear of the furniture because a door has to open. A window does
  // not, and making it dodge the sofa leaves a wall of windowless corners.
  expect(window.t).toBeCloseTo(0.5, 5)
})

const SMALL =
  'add-room --material tile-white --shape rectangle --width 2m --depth 2m --name předsíň'

const clash = (one: Box, other: Box) =>
  one.x0 < other.x1 && other.x0 < one.x1 && one.y0 < other.y1 && other.y0 < one.y1

test('two doors in one small room do not swing into each other', () => {
  const doc = runScript(
    createEmptyDocument(),
    [
      SMALL,
      'add-opening --kind door --room předsíň --side north --width 0.9m',
      'add-opening --kind door --room předsíň --side east --width 0.9m',
    ].join('\n'),
  )
  const boxes = openings(doc).map((opening) => swingOf(doc, opening)!)

  // Centred on their own walls they would both sweep the same corner, and a plan
  // that draws two doors banging into each other is not a plan of anything.
  expect(boxes).toHaveLength(2)
  expect(clash(boxes[0]!, boxes[1]!)).toBe(false)
})

test('a door does not swing into the furniture already standing in the room', () => {
  const doc = runScript(
    createEmptyDocument(),
    [
      SMALL,
      'add-object --room předsíň --type vanity-sink --against west',
      'add-opening --kind door --room předsíň --side north --width 0.9m',
    ].join('\n'),
  )
  const swing = swingOf(doc, openings(doc)[0]!)!

  // The vanity stands halfway along the west wall and reaches half a metre out,
  // which is exactly where a door centred on the north wall would open.
  expect(swing.x0).toBeGreaterThan(650)
})
