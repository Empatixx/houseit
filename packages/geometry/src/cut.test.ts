import { expect, test } from 'vitest'
import { crossingsOf } from './cut'
import { roomsOf } from './rooms'
import { planWith } from './test-utils'

const rectangle = () =>
  planWith([
    [0, 0, 12_000, 0],
    [12_000, 0, 12_000, 9000],
    [12_000, 9000, 0, 9000],
    [0, 9000, 0, 0],
  ])

test('a line across a room meets its boundary exactly twice', () => {
  const { doc, level } = rectangle()
  const room = roomsOf(doc, level)[0]!

  const crossings = crossingsOf(doc, level, room, 'x', 3600)

  expect(crossings).toHaveLength(2)
})

test('the crossings report where the line meets the wall and which wall it is', () => {
  const { doc, level } = rectangle()
  const room = roomsOf(doc, level)[0]!

  const ys = crossingsOf(doc, level, room, 'x', 3600)
    .map((crossing) => crossing.point.y)
    .sort((a, b) => a - b)

  expect(ys).toEqual([0, 9000])
  for (const crossing of crossingsOf(doc, level, room, 'x', 3600)) {
    expect(crossing.point.x).toBe(3600)
    expect(doc.walls[crossing.wall]).toBeDefined()
  }
})

test('a line beyond the room meets nothing', () => {
  const { doc, level } = rectangle()
  const room = roomsOf(doc, level)[0]!

  expect(crossingsOf(doc, level, room, 'x', 20_000)).toHaveLength(0)
})

test('a horizontal line works the same way', () => {
  const { doc, level } = rectangle()
  const room = roomsOf(doc, level)[0]!

  const xs = crossingsOf(doc, level, room, 'y', 2500)
    .map((crossing) => crossing.point.x)
    .sort((a, b) => a - b)

  expect(xs).toEqual([0, 12_000])
})

test('a line laid exactly along a wall is not a crossing', () => {
  const { doc, level } = rectangle()
  const room = roomsOf(doc, level)[0]!

  expect(crossingsOf(doc, level, room, 'x', 0)).toHaveLength(0)
})
