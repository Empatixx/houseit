import { flightWidthOf, stairShape, treadsOf } from '@houseit/core/stairs'
import { expect, test } from 'vitest'
import { PAINT } from '../finishes'
import { staircase } from './stairs'

const STOREY = 2900
const PART = { w: 1000, d: 4000, h: STOREY, body: PAINT.wall, frame: PAINT.steel }

test('a flight is built at the tread count the storey calls for, not at one of its own', () => {
  const shape = stairShape('straight', STOREY, flightWidthOf('straight', PART.w, STOREY))

  expect(staircase('straight')(PART)).toHaveLength(treadsOf(shape).length)
})

test('a tread is an outline, not a box, because a winder turns on wedges', () => {
  const built = staircase('l-winder')(PART)

  expect(built.every((piece) => piece.body.kind === 'prism')).toBe(true)
})

test('each tread stands one riser above the one below it', () => {
  const built = staircase('straight')(PART)
  const shape = stairShape('straight', STOREY, flightWidthOf('straight', PART.w, STOREY))
  const rise = STOREY / shape.risers

  const bases = built.map((piece) => piece.at.y).sort((a, b) => a - b)
  expect(bases[1]! - bases[0]!).toBeCloseTo(rise)
})

test('a spiral has a newel down its middle on top of its treads', () => {
  const spiral = staircase('spiral')(PART)

  expect(spiral.filter((piece) => piece.body.kind === 'drum')).toHaveLength(1)
})

test('the drawing left is the thing right, so a tread is laid on turned half round', () => {
  const shape = stairShape('straight', STOREY, flightWidthOf('straight', PART.w, STOREY))
  const first = treadsOf(shape)[0]!
  const built = staircase('straight')(PART)[0]!

  if (built.body.kind !== 'prism') throw new Error('a tread is a prism')
  expect(built.body.outline[0]).toEqual({
    x: shape.size.width / 2 - first.outline[0]!.x,
    z: shape.size.depth / 2 - first.outline[0]!.y,
  })
})
