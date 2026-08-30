import { expect, test } from 'vitest'
import { boundaryWallsOf } from './boundary'
import { roomsOf } from './rooms'
import { planWith } from './test-utils'

const idsOf = (walls: { id: string }[]) => walls.map((wall) => wall.id).sort()

test('a room lists the walls that bound it', () => {
  const { doc, level } = planWith([
    [0, 0, 6000, 0],
    [6000, 0, 6000, 3000],
    [6000, 3000, 0, 3000],
    [0, 3000, 0, 0],
  ])

  const room = roomsOf(doc, level)[0]!

  expect(idsOf(boundaryWallsOf(doc, level, room))).toEqual(['w1', 'w2', 'w3', 'w4'])
})

test('a room bounded by half of a split wall lists that half, not the whole span', () => {
  const { doc, level } = planWith([
    [0, 0, 4000, 0],
    [4000, 0, 6000, 0],
    [6000, 0, 6000, 3000],
    [6000, 3000, 4000, 3000],
    [4000, 3000, 0, 3000],
    [0, 3000, 0, 0],
    [4000, 0, 4000, 3000],
  ])

  const west = roomsOf(doc, level).find((room) => room.area === 4000 * 3000)!

  expect(idsOf(boundaryWallsOf(doc, level, west))).toEqual(['w1', 'w5', 'w6', 'w7'])
})
