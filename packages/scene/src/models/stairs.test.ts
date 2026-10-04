import { flightWidthOf, stairShape, treadsOf } from '@houseit/core/stairs'
import { expect, test } from 'vitest'
import { PAINT } from '../finishes'
import { staircase } from './stairs'

const STOREY = 2900
const PART = { w: 1000, d: 4000, h: STOREY, body: PAINT.wall, frame: PAINT.steel }

test('a flight is built at the tread count the storey calls for, not at one of its own', () => {
  const shape = stairShape('straight', STOREY, flightWidthOf('straight', PART.w, STOREY))

  const treads = staircase('straight')(PART).filter((piece) => piece.name?.startsWith('tread-'))
  expect(treads).toHaveLength(treadsOf(shape).length)
})

test('a tread is an outline, not a box, because a winder turns on wedges', () => {
  const built = staircase('l-winder')(PART).filter((piece) => piece.role === 'stair-solid')

  expect(built.every((piece) => piece.body.kind === 'prism')).toBe(true)
})

test('each tread stands one riser above the one below it', () => {
  const built = staircase('straight')(PART).filter((piece) => piece.name?.startsWith('tread-'))
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

test('a tread is a board of the finish over a riser block, together one riser tall', () => {
  const built = staircase('straight')(PART)
  const shape = stairShape('straight', STOREY, flightWidthOf('straight', PART.w, STOREY))
  const rise = STOREY / shape.risers
  const board = built.find((piece) => piece.name === 'tread-1')!
  const riser = built.find((piece) => piece.name === 'riser-1')!
  if (board.body.kind !== 'prism' || riser.body.kind !== 'prism') throw new Error('prisms')
  expect(board.paint).toBe(PART.body)
  expect(board.body.thickness + riser.body.thickness).toBeCloseTo(rise)
  expect(board.at.y + board.body.thickness / 2).toBeCloseTo(rise)
})

const handrails = (kind: Parameters<typeof staircase>[0]) =>
  staircase(kind)(PART).filter((piece) => piece.name?.startsWith('handrail-'))

test('every flight is guarded: balusters on both sides and a handrail that climbs with it', () => {
  for (const kind of ['straight', 'l-landing', 'l-winder', 'u', 'spiral'] as const) {
    const built = staircase(kind)(PART)
    expect(
      built.filter((piece) => piece.name?.startsWith('baluster-')).length,
      kind,
    ).toBeGreaterThan(10)
    expect(handrails(kind).length, kind).toBeGreaterThan(5)
  }
  const straight = handrails('straight')
  const heights = straight.map((piece) => piece.at.y)
  expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(STOREY / 2)
})

test('the guard stands inside the flight, not outside its footprint', () => {
  for (const kind of ['straight', 'l-landing', 'u'] as const) {
    const shape = stairShape(kind, STOREY, flightWidthOf(kind, PART.w, STOREY))
    for (const piece of staircase(kind)(PART).filter((p) => p.name?.startsWith('baluster-'))) {
      expect(Math.abs(piece.at.x), kind).toBeLessThan(shape.size.width / 2)
      expect(Math.abs(piece.at.z), kind).toBeLessThan(shape.size.depth / 2)
    }
  }
})

test('nothing in a balustrade is degenerate, whatever the width', () => {
  for (const kind of ['straight', 'l-landing', 'l-winder', 'u', 'spiral'] as const)
    for (const w of [700, 900, 1000, 1200, 1800, 2115]) {
      for (const piece of staircase(kind)({ ...PART, w })) {
        const numbers = [piece.at.x, piece.at.y, piece.at.z, piece.tilt ?? 0, piece.turn ?? 0]
        expect(numbers.every(Number.isFinite), `${kind} ${w} ${piece.name}`).toBe(true)
        if (piece.body.kind === 'box') expect(piece.body.height, piece.name).toBeGreaterThan(0)
      }
    }
})
