import { expect, test } from 'vitest'
import { anchorInside } from './anchor'
import { containsPoint } from './rooms'

test('a rectangle is anchored at its middle', () => {
  const box = [
    { x: 0, y: 0 },
    { x: 6000, y: 0 },
    { x: 6000, y: 4000 },
    { x: 0, y: 4000 },
  ]
  expect(anchorInside(box, 24_000_000)).toEqual({ x: 3000, y: 2000 })
})

test('a horseshoe is anchored inside one of its arms, not in the gap', () => {
  // A U: 12 wide, 9 deep, with a 4 by 6 gap cut into the middle of the north side.
  const u = [
    { x: 0, y: 0 },
    { x: 12_000, y: 0 },
    { x: 12_000, y: 9000 },
    { x: 8000, y: 9000 },
    { x: 8000, y: 3000 },
    { x: 4000, y: 3000 },
    { x: 4000, y: 9000 },
    { x: 0, y: 9000 },
  ]
  const area = 12_000 * 9000 - 4000 * 6000
  const anchor = anchorInside(u, area)
  expect(containsPoint(u, anchor.x, anchor.y)).toBe(true)
})
