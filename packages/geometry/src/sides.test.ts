import { expect, test } from 'vitest'
import { roomsOf } from './rooms'
import { sideOfWall, sideRun, wallOnSide } from './sides'
import { planWith } from './test-utils'

const only = () => {
  const { doc, level } = planWith([
    [0, 0, 6000, 0],
    [6000, 0, 6000, 3000],
    [6000, 3000, 0, 3000],
    [0, 3000, 0, 0],
  ])
  return { doc, level, room: roomsOf(doc, level)[0]! }
}

test('each side of a box finds its own wall', () => {
  const { doc, level, room } = only()

  expect(wallOnSide(doc, level, room, 'south')?.wall).toBe('w1')
  expect(wallOnSide(doc, level, room, 'east')?.wall).toBe('w2')
  expect(wallOnSide(doc, level, room, 'north')?.wall).toBe('w3')
  expect(wallOnSide(doc, level, room, 'west')?.wall).toBe('w4')
})

test('a run is ordered the same way whichever way its wall was drawn', () => {
  const { doc, level, room } = only()

  expect(sideRun(doc, level, room, 'south')!.from.x).toBeLessThan(
    sideRun(doc, level, room, 'south')!.to.x,
  )
  expect(sideRun(doc, level, room, 'north')!.from.x).toBeLessThan(
    sideRun(doc, level, room, 'north')!.to.x,
  )
})

test('a run knows which way the room lies from it, and how thick its wall is', () => {
  const { doc, level, room } = only()

  expect(sideRun(doc, level, room, 'south')?.inward).toEqual({ x: 0, y: 1 })
  expect(sideRun(doc, level, room, 'north')?.inward).toEqual({ x: 0, y: -1 })
  expect(sideRun(doc, level, room, 'south')?.thickness).toBe(150)
})

test('a room with no wall along a side says so instead of offering another', () => {
  const { doc, level } = planWith([
    [0, 0, 4000, 0],
    [4000, 0, 2000, 3000],
    [2000, 3000, 0, 0],
  ])
  const room = roomsOf(doc, level)[0]!

  expect(wallOnSide(doc, level, room, 'south')?.wall).toBe('w1')
  expect(wallOnSide(doc, level, room, 'north')).toBeUndefined()
})

test('a run stops at the faces of the walls crossing it, not at their middles', () => {
  const { doc, level, room } = only()

  const run = sideRun(doc, level, room, 'north')!

  // Six metres between the corners, but a corner is the middle of a wall a
  // hundred and fifty thick. Half of each end belongs to the wall beside it, and
  // anything spread along the whole six metres has its ends buried in masonry.
  expect(run.length).toBe(6000 - 150)
})

test('a side split into two walls in line is still one run', () => {
  // A hall with a partition landing on its far side: the wall it lands on is two
  // walls now, but the hall is one room and its side is one stretch of it.
  const { doc, level } = planWith([
    [0, 0, 6000, 0],
    [6000, 0, 6000, 3000],
    [6000, 3000, 3000, 3000],
    [3000, 3000, 0, 3000],
    [0, 3000, 0, 0],
    [3000, 3000, 3000, 6000],
  ])
  const room = roomsOf(doc, level).find((found) => found.centre.y < 3000)!

  const run = sideRun(doc, level, room, 'north')!

  // Six metres of wall, less half of each end wall — not the near half of it
  // because a partition happens to meet it in the middle.
  expect(run.length).toBe(6000 - 150)
})

test('a wall is on the side of the room it faces into from', () => {
  const { doc, level } = planWith([
    [0, 0, 6000, 0],
    [6000, 0, 6000, 4000],
    [6000, 4000, 0, 4000],
    [0, 4000, 0, 0],
  ])
  const room = roomsOf(doc, level)[0]!

  const sides = Object.values(doc.walls).map((wall) => {
    const a = doc.nodes[wall.a]!
    const b = doc.nodes[wall.b]!
    return `${sideOfWall(doc, level, room, wall.id)}:${(a.y + b.y) / 2},${(a.x + b.x) / 2}`
  })

  expect(sides.sort()).toEqual(['east:2000,6000', 'north:4000,3000', 'south:0,3000', 'west:2000,0'])
})

test('a wall the room does not walk is on no side of it', () => {
  const { doc, level } = planWith([
    [0, 0, 6000, 0],
    [6000, 0, 6000, 4000],
    [6000, 4000, 0, 4000],
    [0, 4000, 0, 0],
  ])
  const room = roomsOf(doc, level)[0]!

  expect(sideOfWall(doc, level, room, 'no-such-wall')).toBeUndefined()
})
