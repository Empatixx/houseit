import { expect, test } from 'vitest'
import { roomsOf } from './rooms'
import { footprintOf, standingAt } from './standing'
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
  const quarter = standingAt(doc, level, room, { ...square, turn: 90 })!

  // A quarter turn about its own middle, on top of the way it faces at that wall.
  expect(quarter.turn - straight.turn).toBeCloseTo(Math.PI / 2)
  // And set back by a thousand rather than four hundred, because turned side-on
  // that is what it now reaches into the room. Left at its own depth, half of a
  // turned thing stands inside the wall.
  expect(straight.at.y - quarter.at.y).toBeCloseTo((1000 - 400) / 2)
})

test('a turned footprint is the corners where they actually are', () => {
  const spot = { at: { x: 0, y: 0 }, turn: Math.PI / 2 }

  const corners = footprintOf(spot, { width: 1000, depth: 400 })

  expect(Math.max(...corners.map((corner) => corner.y))).toBeCloseTo(500)
  expect(Math.max(...corners.map((corner) => corner.x))).toBeCloseTo(200)
})
