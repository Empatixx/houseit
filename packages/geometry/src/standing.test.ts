import { expect, test } from 'vitest'
import { roomsOf } from './rooms'
import { footprintOf, piecesOf, standingAt } from './standing'
import { planWith } from './test-utils'

const only = () => {
  const { doc, level } = planWith([
    [0, 0, 6000, 0],
    [6000, 0, 6000, 4000],
    [6000, 4000, 0, 4000],
    [0, 4000, 0, 0],
  ])
  return { doc, level, room: roomsOf(doc, level)[0]! }
}

test('a thing given a turn is turned where it stands, and set back by what it then takes', () => {
  const { doc, level, room } = only()
  const square = { against: 'north' as const, along: 0.5, width: 1000, depth: 400 }

  const straight = standingAt(doc, level, room, square)!
  const quarter = standingAt(doc, level, room, { ...square, rotation: 90 })!

  expect(quarter.turn - straight.turn).toBeCloseTo(Math.PI / 2)
  expect(straight.at.y - quarter.at.y).toBeCloseTo((1000 - 400) / 2)
})

test('a turned footprint is the corners where they actually are', () => {
  const spot = { at: { x: 0, y: 0 }, turn: Math.PI / 2 }

  const corners = footprintOf(spot, { width: 1000, depth: 400 })

  expect(Math.max(...corners.map((corner) => corner.y))).toBeCloseTo(500)
  expect(Math.max(...corners.map((corner) => corner.x))).toBeCloseTo(200)
})

test('the parts of a thing lie where its drawing puts them, not in its mirror image', () => {
  const { doc, level, room } = only()
  const sofa = { type: 'sofa-l', against: 'south' as const, along: 0.5, width: 3000, depth: 1800 }
  const spot = standingAt(doc, level, room, sofa)!

  const [, chaise] = piecesOf(spot, sofa)

  expect(chaise).toBeDefined()
  for (const corner of chaise!) expect(corner.x).toBeLessThanOrEqual(spot.at.x + 1)
})
