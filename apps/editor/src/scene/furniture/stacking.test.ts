import { expect, test } from 'vitest'
import type { Part } from './skeleton'
import { planHeight, STEP } from './stacking'

const part = (lift: number): Part => ({
  key: 'p',
  kind: 'rect',
  x: 0,
  y: 0,
  width: 100,
  depth: 100,
  lift,
  base: 0,
  height: 10,
})

test('a rug under the floor, a console on it, a television on top of that', () => {
  const rug = planHeight(part(8), { layer: 'under', index: 0 })
  const stand = planHeight(part(8), { layer: 'floor', index: 40 })
  const tv = planHeight(part(0), { layer: 'over', index: 1 })

  expect(rug).toBeLessThan(stand)
  expect(stand).toBeLessThan(tv)
})

test('a higher part of one thing covers a lower one', () => {
  const top = planHeight(part(8), { layer: 'floor', index: 3 })
  const seat = planHeight(part(2), { layer: 'floor', index: 3 })

  expect(top).toBeGreaterThan(seat)
})

test('a nudge is never big enough to reorder the parts of one thing', () => {
  for (let index = 0; index < 200; index += 1) {
    const lower = planHeight(part(0), { layer: 'floor', index })
    const higher = planHeight(part(1), { layer: 'floor', index: 0 })
    expect(lower, `object ${index}`).toBeLessThan(higher + STEP)
  }
})

test('no two objects come out at the same height, or the drawing flickers', () => {
  const heights = Array.from({ length: 64 }, (_, index) =>
    planHeight(part(2), { layer: 'floor', index }),
  )

  expect(new Set(heights).size).toBe(heights.length)
})
