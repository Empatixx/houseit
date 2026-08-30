import { expect, test } from 'vitest'
import { outlinePoints } from './outlines'

const areaOf = (points: { x: number; y: number }[]) => {
  let total = 0
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!
    const b = points[(i + 1) % points.length]!
    total += a.x * b.y - b.x * a.y
  }
  return Math.abs(total / 2)
}

test('a rectangle is four corners of the given size', () => {
  const points = outlinePoints({ kind: 'rectangle', width: 12_000, depth: 9000 })

  expect(points).toHaveLength(4)
  expect(areaOf(points)).toBe(12_000 * 9000)
})

test('an L is a rectangle with a corner bitten out', () => {
  const points = outlinePoints({
    kind: 'l',
    width: 12_000,
    depth: 9000,
    notchWidth: 4500,
    notchDepth: 3000,
  })

  expect(points).toHaveLength(6)
  expect(areaOf(points)).toBe(12_000 * 9000 - 4500 * 3000)
})

test('a U is a rectangle with a notch cut into the north side', () => {
  const points = outlinePoints({
    kind: 'u',
    width: 12_000,
    depth: 9000,
    notchWidth: 4000,
    notchDepth: 4000,
  })

  expect(points).toHaveLength(8)
  expect(areaOf(points)).toBe(12_000 * 9000 - 4000 * 4000)
})

test('a T is a wide bar to the north with a stem running south', () => {
  const points = outlinePoints({
    kind: 't',
    width: 12_000,
    depth: 9000,
    barDepth: 4000,
    stemWidth: 5000,
  })

  expect(points).toHaveLength(8)
  expect(areaOf(points)).toBe(12_000 * 4000 + 5000 * 5000)
})

test('every outline runs counter-clockwise, so face detection finds it', () => {
  let total = 0
  const points = outlinePoints({ kind: 'rectangle', width: 4000, depth: 3000 })
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!
    const b = points[(i + 1) % points.length]!
    total += a.x * b.y - b.x * a.y
  }

  expect(total).toBeGreaterThan(0)
})

test('a notch that swallows the building is refused', () => {
  expect(() =>
    outlinePoints({ kind: 'l', width: 6000, depth: 4000, notchWidth: 6000, notchDepth: 4000 }),
  ).toThrow()
})
