import type { HouseObject } from '@houseit/core/document'
import { OBJECT_TYPES } from '@houseit/core/object-types'
import { expect, test } from 'vitest'
import { boundsOf } from './bounds'
import type { Part } from './skeleton'
import { skeletonOf } from './skeleton'

const part = (over: Partial<Part>): Part => ({
  key: 'p',
  kind: 'rect',
  x: 0,
  y: 0,
  width: 100,
  depth: 400,
  lift: 0,
  base: 0,
  height: 10,
  ...over,
})

test('a part on its side is measured on its side', () => {
  expect(boundsOf([part({})])).toEqual({ width: 100, depth: 400 })
  expect(boundsOf([part({ turn: Math.PI / 2 })]).width).toBeCloseTo(400)
  expect(boundsOf([part({ turn: Math.PI / 2 })]).depth).toBeCloseTo(100)
})

test('a part off the middle is measured from the middle', () => {
  expect(boundsOf([part({ x: 300, width: 100, depth: 100 })]).width).toBe(700)
})

test('a disc measures the same whichever way it is turned', () => {
  const round = part({ kind: 'disc', width: 200, depth: 200, turn: 0.7 })

  expect(boundsOf([round])).toEqual({ width: 200, depth: 200 })
})

/**
 * The check that keeps the two halves honest. What a command validates is the
 * size in the catalogue; what the plan shows is the skeleton. If the drawing ever
 * grows past what the catalogue promises, a thing gets placed against a wall it
 * actually overlaps — which is exactly what a rug's fringe did.
 */
test('nothing is drawn beyond the size its type declares', () => {
  for (const type of OBJECT_TYPES) {
    const object: HouseObject = {
      id: 'f1',
      level: 'l1',
      room: 'r1',
      type: type.id,
      along: 0.5,
      width: type.size.width,
      depth: type.size.depth,
      surface: type.surfaces[0]!,
      ...(type.seats ? { seats: type.seats } : {}),
    }
    const drawn = boundsOf(skeletonOf(object))
    const allowed = {
      width: type.size.width + (type.reach ?? 0) * 2,
      depth: type.size.depth + (type.reach ?? 0) * 2,
    }

    expect(drawn.width, `${type.id} across`).toBeLessThanOrEqual(allowed.width + 1)
    expect(drawn.depth, `${type.id} deep`).toBeLessThanOrEqual(allowed.depth + 1)
  }
})
