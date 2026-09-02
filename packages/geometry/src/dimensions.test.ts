import { expect, test } from 'vitest'
import { extentDimensions, objectClearances, planExtent, roomDimensions } from './dimensions'
import { roomsOf } from './rooms'
import { planWith } from './test-utils'

/** A 6 by 4 room in 150 mm walls. */
const box = () =>
  planWith([
    [0, 0, 6000, 0],
    [6000, 0, 6000, 4000],
    [6000, 4000, 0, 4000],
    [0, 4000, 0, 0],
  ])

test('a room is measured between the faces of its walls, one dimension a wall', () => {
  const { doc, level } = box()
  const room = roomsOf(doc, level)[0]!

  const lengths = roomDimensions(doc, level, room)
    .map((dimension) => dimension.length)
    .sort((one, other) => one - other)

  // Six metres between centre lines, less half a wall at each end.
  expect(lengths).toEqual([3850, 3850, 5850, 5850])
})

test('a dimension line stands inside the room, off the wall it measures', () => {
  const { doc, level } = box()
  const room = roomsOf(doc, level)[0]!

  for (const dimension of roomDimensions(doc, level, room)) {
    for (const end of [dimension.from, dimension.to]) {
      expect(end.x).toBeGreaterThan(0)
      expect(end.x).toBeLessThan(6000)
      expect(end.y).toBeGreaterThan(0)
      expect(end.y).toBeLessThan(4000)
    }
  }
})

test('a wall dangling into a room is measured once, not once each way', () => {
  const { doc, level } = planWith([
    [0, 0, 3000, 0],
    [3000, 0, 6000, 0],
    [6000, 0, 6000, 4000],
    [6000, 4000, 0, 4000],
    [0, 4000, 0, 0],
    [3000, 0, 3000, 1500],
  ])
  const room = roomsOf(doc, level)[0]!

  // The south wall in two, the other three, and the stub once — not once each way.
  expect(roomDimensions(doc, level, room)).toHaveLength(6)
})

test('the extent of a level reaches the outer faces of its walls', () => {
  const { doc, level } = box()

  expect(planExtent(doc, level)).toEqual({ x0: -75, y0: -75, x1: 6075, y1: 4075 })
  const [width, depth] = extentDimensions(planExtent(doc, level)!)
  expect(width!.length).toBe(6150)
  expect(depth!.length).toBe(4150)
})

test('a level with no walls has no extent', () => {
  const { doc, level } = planWith([])
  expect(planExtent(doc, level)).toBeUndefined()
})

test('a thing is measured to the wall faces on all four sides', () => {
  const { doc, level } = box()
  const room = roomsOf(doc, level)[0]!
  const spot = { at: { x: 2000, y: 1500 }, turn: 0 }

  const clearances = objectClearances(doc, level, room, spot, { width: 1000, depth: 800 })
  const bySide = Object.fromEntries(clearances.map((entry) => [entry.side, entry.length]))

  // West face at 75, east at 5925, south at 75, north at 3925.
  expect(bySide).toEqual({ west: 1425, east: 3425, south: 1025, north: 2025 })
})

test('a side that faces no wall gets no clearance', () => {
  // An L: the room bends away to the north-east, so from the west leg nothing
  // lies due east above the bend.
  const { doc, level } = planWith([
    [0, 0, 4000, 0],
    [4000, 0, 4000, 2000],
    [4000, 2000, 8000, 2000],
    [8000, 2000, 8000, 4000],
    [8000, 4000, 0, 4000],
    [0, 4000, 0, 0],
  ])
  const room = roomsOf(doc, level)[0]!
  const spot = { at: { x: 1000, y: 3000 }, turn: 0 }

  const clearances = objectClearances(doc, level, room, spot, { width: 500, depth: 500 })
  const east = clearances.find((entry) => entry.side === 'east')

  // Due east of the thing the room runs on to the far wall at 8000.
  expect(east?.length).toBe(8000 - 75 - 1250)
})
