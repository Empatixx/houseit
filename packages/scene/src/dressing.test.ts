import { expect, test } from 'vitest'
import { besideWall, isColour, paintFor } from './dressing'

const BARE = '#f1f0ed'

test('a room that was never dressed keeps the bare colour', () => {
  expect(paintFor(undefined, BARE)).toEqual({ colour: BARE })
})

test('a finish that is a colour is worn as that colour', () => {
  expect(paintFor('black', BARE)).toEqual({ colour: '#000000' })
})

test('a finish that is a picture is worn as a texture, asked for from the site root', () => {
  const worn = paintFor('brick-beige', BARE)

  expect(worn.texture).toBe('/finishes/brick-beige.jpg')
  expect(worn.colour).toBe('#ffffff')
  expect(worn.repeat).toBeDefined()
})

const wall = { width: 4000, height: 2800 }

test('a brick repeats more often than a sheet of concrete, because a brick is smaller', () => {
  const brick = paintFor('brick-beige', BARE, wall).repeat!
  const concrete = paintFor('concrete-light', BARE, wall).repeat!

  expect(brick.y).toBeGreaterThan(concrete.y)
})

test('the same brick is the same size on a long wall and on a short one', () => {
  const long = paintFor('brick-beige', BARE, { width: 4000, height: 2800 }).repeat!
  const short = paintFor('brick-beige', BARE, { width: 1000, height: 2800 }).repeat!

  expect(long.x / 4000).toBeCloseTo(short.x / 1000, 3)
  expect(long.y).toBe(short.y)
})

test('a colour of your own is worn as it is written', () => {
  expect(paintFor('#c86432', BARE)).toEqual({ colour: '#c86432' })
})

test('a colour of your own is read whatever case it is written in', () => {
  expect(paintFor('#C86432', BARE)).toEqual({ colour: '#C86432' })
})

test('a finish nobody has heard of falls back rather than rendering as nothing', () => {
  expect(paintFor('bogus', BARE)).toEqual({ colour: BARE })
})

test('a colour is told from a name, so the two can share one field', () => {
  expect(isColour('#ffffff')).toBe(true)
  expect(isColour('#FFF')).toBe(false)
  expect(isColour('white')).toBe(false)
  expect(isColour(undefined)).toBe(false)
})

const square = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
]

test('a wall between two rooms wears one room on one face and the other on the other', () => {
  const rooms = [
    { outline: square(0, 0, 3000, 5000), worn: { walls: 'brick-red' } },
    { outline: square(3000, 0, 8000, 5000), worn: { walls: 'black' } },
  ]

  const worn = besideWall(rooms, { x: 3000, y: 0 }, { x: 3000, y: 5000 }, 150).map(
    (room) => room?.walls,
  )

  expect([...worn].sort()).toEqual(['black', 'brick-red'])
})

test('an outside wall has a room on one face and nothing on the other', () => {
  const rooms = [{ outline: square(0, 0, 6000, 4000), worn: { walls: 'brick-red' } }]

  const worn = besideWall(rooms, { x: 0, y: 0 }, { x: 6000, y: 0 }, 300)

  expect(worn.filter((side) => side !== undefined).map((side) => side?.walls)).toEqual([
    'brick-red',
  ])
})

test('a face is read from just inside the room, not from the middle of the wall', () => {
  const rooms = [{ outline: square(0, 0, 6000, 4000), worn: { doors: 'black' } }]

  const worn = besideWall(rooms, { x: 0, y: 4000 }, { x: 6000, y: 4000 }, 400)

  expect(worn.map((side) => side?.doors)).toContain('black')
})
