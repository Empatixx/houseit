import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import type { Box } from './boxes'
import { swingOf } from './place-opening'
import { runScript } from './run'

const FLOOR =
  'floor-shape --material natural-oak --kind rectangle --width 12m --depth 9m --name dům'
const CUT = 'add-room --material natural-oak --name kuchyň --from dům --side west --width 3.6m'

const floor = () => {
  const doc = createEmptyDocument()
  const level = Object.keys(doc.levels)[0]!
  return { doc: runScript(doc, FLOOR), level }
}

const openings = (doc: HouseDocument) => Object.values(doc.openings)

test('a door is an opening that reaches the floor', () => {
  const { doc } = floor()

  const next = runScript(doc, 'add-door --room dům --side south')

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

  const next = runScript(doc, [CUT, 'add-door --room kuchyň --side east'].join('\n'))
  const wall = next.walls[openings(next)[0]!.wall]!

  expect(next.nodes[wall.a]!.x).toBe(3600)
  expect(next.nodes[wall.b]!.x).toBe(3600)
})

test('a door swings into the room it was named from, so the two sides disagree', () => {
  const { doc } = floor()

  const next = runScript(
    doc,
    [CUT, 'add-door --room kuchyň --side east', 'add-door --room dům --side west'].join('\n'),
  )
  const [fromKitchen, fromLiving] = openings(next)

  expect(fromKitchen!.wall).toBe(fromLiving!.wall)
  expect(fromKitchen!.swing).toBe(-fromLiving!.swing)
})

test('dimensions can be given', () => {
  const { doc } = floor()

  const next = runScript(doc, 'add-door --room dům --side south --width 0.9m --height 2.1m')

  expect(openings(next)).toEqual([expect.objectContaining({ width: 900, height: 2100 })])
})

test('a door and a window can share a wall without overlapping', () => {
  const { doc } = floor()

  const next = runScript(
    doc,
    ['add-door --room dům --side south', 'add-window --room dům --side south --width 2m'].join(
      '\n',
    ),
  )
  const [door, window_] = openings(next)

  expect(door!.wall).toBe(window_!.wall)
  expect(Math.abs(door!.t - window_!.t) * 12_000).toBeGreaterThan((800 + 2000) / 2)
})

test('putting a door in a room that does not exist says so', () => {
  const { doc } = floor()

  expect(() => runScript(doc, 'add-door --room garáž --side south')).toThrow(/garáž/)
})

test('a door is not hung behind the furniture already standing at that wall', () => {
  const { doc } = floor()

  const next = runScript(
    doc,
    [
      // Three metres of sofa across the middle of the twelve metre wall.
      'add-object --room dům --type sofa-3 --against north --width 3m',
      'add-door --room dům --side north --width 0.9m',
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
      'add-door --room dům --side west --width 0.9m',
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

const SMALL =
  'floor-shape --material tile-white --kind rectangle --width 2m --depth 2m --name předsíň'

const clash = (one: Box, other: Box) =>
  one.x0 < other.x1 && other.x0 < one.x1 && one.y0 < other.y1 && other.y0 < one.y1

test('two doors in one small room do not swing into each other', () => {
  const doc = runScript(
    createEmptyDocument(),
    [
      SMALL,
      'add-door --room předsíň --side north --width 0.9m',
      'add-door --room předsíň --side east --width 0.9m',
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
      'add-door --room předsíň --side north --width 0.9m',
    ].join('\n'),
  )
  const swing = swingOf(doc, openings(doc)[0]!)!

  // The vanity stands halfway along the west wall and reaches half a metre out,
  // which is exactly where a door centred on the north wall would open.
  expect(swing.x0).toBeGreaterThan(650)
})
