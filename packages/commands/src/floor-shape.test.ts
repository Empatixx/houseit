import { createEmptyDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { expect, test } from 'vitest'
import { runScript } from './run'

const empty = () => {
  const doc = createEmptyDocument()
  return { doc, level: Object.keys(doc.levels)[0]! }
}

test('a rectangular floor encloses one room of the stated size', () => {
  const { doc, level } = empty()

  const next = runScript(doc, 'floor-shape --material oak --kind rectangle --width 12m --depth 9m')
  const rooms = roomsOf(next, level)

  expect(rooms).toHaveLength(1)
  expect(rooms[0]?.area).toBe(12_000 * 9000)
})

test('the floor starts as one named room you can cut from', () => {
  const { doc, level } = empty()

  const next = runScript(
    doc,
    'floor-shape --material oak --kind rectangle --width 12m --depth 9m --name dům',
  )

  expect(roomsOf(next, level)[0]?.name).toBe('dům')
})

test('an L-shaped floor loses the area of its notch', () => {
  const { doc, level } = empty()

  const next = runScript(
    doc,
    'floor-shape --material oak --kind l --width 12m --depth 9m --notch-width 4.5m --notch-depth 3m',
  )

  expect(roomsOf(next, level)[0]?.area).toBe(12_000 * 9000 - 4500 * 3000)
})

test('options are written the way they read, with dashes', () => {
  const { doc } = empty()

  expect(() =>
    runScript(
      doc,
      'floor-shape --material oak --kind u --width 12m --depth 9m --notch-width 4m --notch-depth 4m',
    ),
  ).not.toThrow()
})

test('an L without its notch dimensions is refused', () => {
  const { doc } = empty()

  expect(() =>
    runScript(doc, 'floor-shape --material oak --kind l --width 12m --depth 9m'),
  ).toThrow(/notch/i)
})

test('drawing a second floor shape over an existing one is refused', () => {
  const { doc } = empty()
  const drawn = runScript(doc, 'floor-shape --material oak --kind rectangle --width 12m --depth 9m')

  expect(() =>
    runScript(drawn, 'floor-shape --material oak --kind rectangle --width 8m --depth 6m'),
  ).toThrow(/already/i)
})

test('exterior walls are thicker than the partitions that will come later', () => {
  const { doc } = empty()

  const next = runScript(doc, 'floor-shape --material oak --kind rectangle --width 12m --depth 9m')

  expect(Object.values(next.walls).every((wall) => wall.thickness === 300)).toBe(true)
})

test('a floor can be walked round instead of chosen from a list', () => {
  const doc = createEmptyDocument()
  const level = Object.keys(doc.levels)[0]!

  const next = runScript(
    doc,
    'floor-shape --material oak --walk "12m e, 8m n, 4m w, 3m n, 8m w" --name dům',
  )
  const rooms = roomsOf(next, level)

  expect(rooms).toHaveLength(1)
  expect(rooms[0]?.area).toBe(12_000 * 8000 + 8000 * 3000)
  expect(new Set(rooms[0]?.nodes).size).toBe(6)
})

test('a walk and a kind cannot both be given', () => {
  expect(() =>
    runScript(
      createEmptyDocument(),
      'floor-shape --material oak --kind rectangle --width 6m --depth 4m --walk "6m e, 4m n, 6m w"',
    ),
  ).toThrow(/kind|walk/)
})

test('a leg with no heading says so', () => {
  expect(() =>
    runScript(createEmptyDocument(), 'floor-shape --material oak --walk "12m, 8m n, 12m w"'),
  ).toThrow(/which way/)
})

test('a walk that cannot get home is refused', () => {
  expect(() =>
    runScript(createEmptyDocument(), 'floor-shape --material oak --walk "6m e, 4m n, 2m w, 1m n"'),
  ).toThrow(/close/)
})
