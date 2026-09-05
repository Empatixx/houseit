import { expect, test } from 'vitest'
import { flightOf } from './levels'
import { flightWidthOf, STAIR_KINDS, stairShape, stairSymbol, treadsOf } from './stairs'

const STOREY = 2800

test('a flight climbs the storey in equal risers nobody would trip on', () => {
  for (const height of [2400, 2600, 2800, 3000, 3600]) {
    const { risers, riser } = flightOf(height)
    // Each riser is a whole millimetre, so the flight can land half a millimetre
    // a step away from the storey — and no further, or somebody trips on the last.
    expect(Math.abs(risers * riser - height), `${height}`).toBeLessThanOrEqual(risers / 2)
    expect(riser, `${height}`).toBeGreaterThanOrEqual(150)
    expect(riser, `${height}`).toBeLessThanOrEqual(200)
  }
})

test('two risers and a going come to a pace, which is what makes a stair walkable', () => {
  for (const height of [2400, 2800, 3200]) {
    const { riser, going } = flightOf(height)
    expect(2 * riser + going, `${height}`).toBeCloseTo(630, -1)
  }
})

test('a taller storey makes a longer flight, because it has more treads to fit in', () => {
  const low = stairShape('straight', 2400)
  const tall = stairShape('straight', 3600)

  expect(tall.risers).toBeGreaterThan(low.risers)
  expect(tall.size.depth).toBeGreaterThan(low.size.depth)
  // And the width is the one thing the storey does not decide.
  expect(tall.size.width).toBe(low.size.width)
})

test('a U is two flights side by side, so its footprint is twice the width asked for', () => {
  const straight = stairShape('straight', STOREY, 900)
  const u = stairShape('u', STOREY, 900)

  expect(u.size.width).toBe(1800)
  // And half the length, give or take the landing across their heads.
  expect(u.size.depth).toBeLessThan(straight.size.depth)
})

test('the width asked for is read back off the footprint, whatever the kind', () => {
  for (const kind of STAIR_KINDS) {
    for (const width of [800, 900, 1100]) {
      const shape = stairShape(kind, STOREY, width)
      expect(flightWidthOf(kind, shape.size.width, STOREY), `${kind} at ${width}`).toBe(width)
    }
  }
})

test('a flight is never narrower than somebody can walk up', () => {
  expect(stairShape('straight', STOREY, 200).size.width).toBe(700)
})

test('every kind draws to a symbol the size of its own footprint', () => {
  for (const kind of STAIR_KINDS) {
    const shape = stairShape(kind, STOREY)
    const svg = stairSymbol(shape)

    expect(svg, kind).toMatch(/^<svg /)
    expect(svg, kind).toContain(`viewBox="0 0 ${shape.size.width} ${shape.size.depth}"`)
    // The white is what a finish replaces, so there has to be some.
    expect(svg, kind).toContain('fill="#ffffff"')
  }
})

test('a straight flight draws one tread for every one it climbs', () => {
  const shape = stairShape('straight', STOREY)
  const treads = stairSymbol(shape).match(/<rect /g)?.length ?? 0

  expect(treads).toBe(shape.risers - 1)
})

test('a spiral turns round a newel rather than running away in a line', () => {
  const svg = stairSymbol(stairShape('spiral', STOREY, 1600))

  // The circle it stands in, the newel in the middle of it, and a line per tread.
  expect(svg.match(/<circle /g)).toHaveLength(2)
  expect((svg.match(/<path /g) ?? []).length).toBeGreaterThan(10)
})

test('every kind has treads, and they all stay on the footprint they claim', () => {
  for (const kind of STAIR_KINDS) {
    const shape = stairShape(kind, STOREY)
    const treads = treadsOf(shape)

    expect(treads.length, kind).toBeGreaterThan(3)
    for (const tread of treads) {
      // The corners of a tread, turned about its own middle as it is drawn.
      const corners = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([sx, sy]) => {
        const x = (sx! * tread.width) / 2
        const y = (sy! * tread.depth) / 2
        return {
          x: tread.cx + x * Math.cos(tread.turn) - y * Math.sin(tread.turn),
          y: tread.cy + x * Math.sin(tread.turn) + y * Math.cos(tread.turn),
        }
      })
      for (const corner of corners) {
        expect(corner.x, `${kind} across`).toBeGreaterThanOrEqual(-1)
        expect(corner.x, `${kind} across`).toBeLessThanOrEqual(shape.size.width + 1)
        expect(corner.y, `${kind} along`).toBeGreaterThanOrEqual(-1)
        expect(corner.y, `${kind} along`).toBeLessThanOrEqual(shape.size.depth + 1)
      }
    }
  }
})

test('the treads are numbered from the foot, each one step above the last', () => {
  for (const kind of STAIR_KINDS) {
    const steps = treadsOf(stairShape(kind, STOREY)).map((tread) => tread.step)
    expect(steps, kind).toEqual(steps.map((_, index) => index + 1))
  }
})

test('a taller storey is more treads to climb, whatever the kind', () => {
  for (const kind of STAIR_KINDS) {
    expect(treadsOf(stairShape(kind, 3600)).length, kind).toBeGreaterThan(
      treadsOf(stairShape(kind, 2400)).length,
    )
  }
})
