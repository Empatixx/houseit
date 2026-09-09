import { expect, test } from 'vitest'
import { clearAreaOf, clearOutline } from './clear'
import { findFaces } from './faces'
import { planWith } from './test-utils'

const SQUARE = planWith([
  [0, 0, 4000, 0],
  [4000, 0, 4000, 3000],
  [4000, 3000, 0, 3000],
  [0, 3000, 0, 0],
])

const nodesOf = (doc: Parameters<typeof findFaces>[0], level: string) =>
  findFaces(doc, level)[0]!.nodes

test('a room is measured inside its walls, not down their middles', () => {
  const { doc, level } = SQUARE
  const nodes = nodesOf(doc, level)

  expect(clearAreaOf(doc, level, nodes)).toBe((4000 - 150) * (3000 - 150))
})

test('each side gives back its own half, so walls of different thicknesses still fit', () => {
  const { doc, level } = planWith([
    [0, 0, 4000, 0],
    [4000, 0, 4000, 3000],
    [4000, 3000, 0, 3000],
    [0, 3000, 0, 0],
  ])
  doc.walls.w1!.thickness = 400
  doc.walls.w3!.thickness = 400

  const nodes = nodesOf(doc, level)
  expect(clearAreaOf(doc, level, nodes)).toBe((4000 - 150) * (3000 - 400))
})

test('the corners of the clear outline are where the inside faces meet', () => {
  const { doc, level } = SQUARE
  const outline = clearOutline(doc, level, nodesOf(doc, level))

  const xs = outline.map((corner) => corner.x).sort((a, b) => a - b)
  const ys = outline.map((corner) => corner.y).sort((a, b) => a - b)
  expect(xs[0]).toBeCloseTo(75, 6)
  expect(xs[3]).toBeCloseTo(3925, 6)
  expect(ys[0]).toBeCloseTo(75, 6)
  expect(ys[3]).toBeCloseTo(2925, 6)
})

test('an L-shaped room keeps its notch when it is measured', () => {
  const { doc, level } = planWith([
    [0, 0, 6000, 0],
    [6000, 0, 6000, 2000],
    [6000, 2000, 3000, 2000],
    [3000, 2000, 3000, 5000],
    [3000, 5000, 0, 5000],
    [0, 5000, 0, 0],
  ])
  const nodes = nodesOf(doc, level)
  const centreline = 6000 * 2000 + 3000 * 3000

  const clear = clearAreaOf(doc, level, nodes)
  expect(clear).toBeLessThan(centreline)
  expect(clear).toBeGreaterThan(centreline * 0.9)
})

test('a shape with no walls under it measures nothing rather than guessing', () => {
  const { doc, level } = SQUARE
  expect(clearAreaOf(doc, level, ['nowhere', 'else', 'again'])).toBe(0)
})
