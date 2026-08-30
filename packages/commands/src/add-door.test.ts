import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { runScript } from './run'

const FLOOR = 'floor-shape --kind rectangle --width 12m --depth 9m --name dům'
const CUT = 'add-room --name kuchyň --from dům --side west --width 3.6m'

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
    expect.objectContaining({ kind: 'door', width: 800, height: 1970, sillHeight: 0 }),
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
