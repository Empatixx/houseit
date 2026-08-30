import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { runScript } from './run'

const FLOOR = 'floor-shape --material oak --kind rectangle --width 12m --depth 9m --name dům'

const floor = () => {
  const doc = createEmptyDocument()
  const level = Object.keys(doc.levels)[0]!
  return { doc: runScript(doc, FLOOR), level }
}

const openings = (doc: HouseDocument) => Object.values(doc.openings)

test('a window goes into the wall on the side it was asked for', () => {
  const { doc } = floor()

  const next = runScript(doc, 'add-window --room dům --side south')
  const [opening] = openings(next)
  const wall = next.walls[opening!.wall]!

  expect(next.nodes[wall.a]!.y).toBe(0)
  expect(next.nodes[wall.b]!.y).toBe(0)
})

test('a window with no dimensions given is a plain 1.2 m one at sill height', () => {
  const { doc } = floor()

  const next = runScript(doc, 'add-window --room dům --side south')

  expect(openings(next)).toEqual([
    expect.objectContaining({ kind: 'window', width: 1200, height: 1500, sillHeight: 900, t: 0.5 }),
  ])
})

test('dimensions can be given', () => {
  const { doc } = floor()

  const next = runScript(
    doc,
    'add-window --room dům --side north --width 2m --height 1.8m --sill 0.6m',
  )

  expect(openings(next)).toEqual([
    expect.objectContaining({ width: 2000, height: 1800, sillHeight: 600 }),
  ])
})

test('a second window on the same wall lands beside the first, not on top of it', () => {
  const { doc } = floor()

  const next = runScript(
    doc,
    ['add-window --room dům --side south', 'add-window --room dům --side south'].join('\n'),
  )
  const [first, second] = openings(next)

  expect(openings(next)).toHaveLength(2)
  expect(first!.wall).toBe(second!.wall)
  expect(Math.abs(first!.t - second!.t) * 12_000).toBeGreaterThanOrEqual(1200)
})

test('a window wider than the wall is refused', () => {
  const { doc } = floor()

  expect(() => runScript(doc, 'add-window --room dům --side south --width 20m')).toThrow(/wall/i)
})

test('a window that no longer fits beside the others is refused', () => {
  const { doc } = floor()

  expect(() =>
    runScript(
      doc,
      [
        'add-window --room dům --side south --width 7m',
        'add-window --room dům --side south --width 7m',
      ].join('\n'),
    ),
  ).toThrow(/room|fit/i)
})

test('windowing a room that does not exist says so', () => {
  const { doc } = floor()

  expect(() => runScript(doc, 'add-window --room garáž --side south')).toThrow(/garáž/)
})

test('a room cut out of another can be windowed on its own outside wall', () => {
  const { doc } = floor()

  const next = runScript(
    doc,
    'add-room --material oak --name kuchyň --from dům --side west --width 3.6m',
  )

  expect(openings(runScript(next, 'add-window --room kuchyň --side west'))).toHaveLength(1)
})

test('a window is happy over the sofa, because that is where a sofa goes', () => {
  const { doc } = floor()

  const next = runScript(
    doc,
    [
      'add-object --room dům --type sofa --against north --width 3m',
      'add-window --room dům --side north --width 1.2m',
    ].join('\n'),
  )
  const window = Object.values(next.openings)[0]!

  // Doors keep clear of the furniture because a door has to open. A window does
  // not, and making it dodge the sofa leaves a wall of windowless corners.
  expect(window.t).toBeCloseTo(0.5, 5)
})
