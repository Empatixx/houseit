import { expect, test } from 'vitest'
import { fitsInside } from './fits'
import type { Point } from './outlines'
import { roomsOf } from './rooms'
import { planWith } from './test-utils'

const box = () => {
  const { doc, level } = planWith([
    [0, 0, 6000, 0],
    [6000, 0, 6000, 4000],
    [6000, 4000, 0, 4000],
    [0, 4000, 0, 0],
  ])
  return { doc, room: roomsOf(doc, level)[0]! }
}

/** An L: the whole 8 x 6 less a 4 x 3 bite out of the north-east. */
const ell = () => {
  const { doc, level } = planWith([
    [0, 0, 8000, 0],
    [8000, 0, 8000, 3000],
    [8000, 3000, 4000, 3000],
    [4000, 3000, 4000, 6000],
    [4000, 6000, 0, 6000],
    [0, 6000, 0, 0],
  ])
  return { doc, room: roomsOf(doc, level)[0]! }
}

const rect = (x: number, y: number, width: number, depth: number): Point[] => [
  { x: x - width / 2, y: y - depth / 2 },
  { x: x + width / 2, y: y - depth / 2 },
  { x: x + width / 2, y: y + depth / 2 },
  { x: x - width / 2, y: y + depth / 2 },
]

test('a thing well inside a room fits', () => {
  const { doc, room } = box()

  expect(fitsInside(doc, room, rect(3000, 2000, 2000, 1000))).toBe(true)
})

test('a thing hanging out over a wall does not', () => {
  const { doc, room } = box()

  expect(fitsInside(doc, room, rect(5500, 2000, 2000, 1000))).toBe(false)
})

test('a thing entirely outside the room does not', () => {
  const { doc, room } = box()

  expect(fitsInside(doc, room, rect(20_000, 20_000, 500, 500))).toBe(false)
})

test('a thing laid across the waist of an L is caught, corners inside or not', () => {
  const { doc, room } = ell()

  // Every corner lands in the L, but the middle bridges the bite out of it.
  const bridging = rect(4000, 4500, 7000, 800)
  expect(bridging.every((corner) => corner.x <= 8000 && corner.y <= 6000)).toBe(true)
  expect(fitsInside(doc, room, bridging)).toBe(false)
})

test('a thing tucked into the leg of an L fits', () => {
  const { doc, room } = ell()

  expect(fitsInside(doc, room, rect(2000, 4500, 3000, 2000))).toBe(true)
})

test('a thing standing flush against a wall is inside, not neither', () => {
  const { doc, room } = box()

  // Its back is exactly on the north wall, which is where furniture goes.
  expect(fitsInside(doc, room, rect(3000, 3500, 2000, 1000))).toBe(true)
})
