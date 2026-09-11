import { expect, test } from 'vitest'
import { roomsOf } from './rooms'
import { planWith } from './test-utils'

function twoRooms() {
  return planWith([
    [0, 0, 4000, 0],
    [4000, 0, 6000, 0],
    [6000, 0, 6000, 3000],
    [6000, 3000, 4000, 3000],
    [4000, 3000, 0, 3000],
    [0, 3000, 0, 0],
    [4000, 0, 4000, 3000],
  ])
}

const label = (id: string, level: string, x: number, y: number, name: string) => ({
  id,
  level,
  x,
  y,
  name,
  loop: [],
})

test('a room takes the name of the label that falls inside it', () => {
  const { doc, level } = twoRooms()
  doc.rooms.r1 = label('r1', level, 2000, 1500, 'kitchen')

  const named = roomsOf(doc, level).find((room) => room.name === 'kitchen')

  expect(named?.area).toBe(4000 * 3000)
})

test('each room takes its own label', () => {
  const { doc, level } = twoRooms()
  doc.rooms.r1 = label('r1', level, 2000, 1500, 'kitchen')
  doc.rooms.r2 = label('r2', level, 5000, 1500, 'hall')

  const names = roomsOf(doc, level)
    .map((room) => room.name)
    .sort()

  expect(names).toEqual(['hall', 'kitchen'])
})

test('a room with no label inside it stays unnamed', () => {
  const { doc, level } = twoRooms()

  expect(roomsOf(doc, level).every((room) => room.name === undefined)).toBe(true)
})

test('a label outside every room names nothing', () => {
  const { doc, level } = twoRooms()
  doc.rooms.r1 = label('r1', level, 20000, 20000, 'garden')

  expect(roomsOf(doc, level).every((room) => room.name === undefined)).toBe(true)
})

test('a label keeps its room after the partition it sits beside moves', () => {
  const { doc, level } = twoRooms()
  doc.rooms.r1 = label('r1', level, 1000, 1500, 'kitchen')

  for (const node of Object.values(doc.nodes)) {
    if (node.x === 4000) node.x = 2000
  }

  const named = roomsOf(doc, level).find((room) => room.name === 'kitchen')

  expect(named?.area).toBe(2000 * 3000)
})

test('a room reports a centre point to hang its label on', () => {
  const { doc, level } = planWith([
    [0, 0, 4000, 0],
    [4000, 0, 4000, 3000],
    [4000, 3000, 0, 3000],
    [0, 3000, 0, 0],
  ])

  const room = roomsOf(doc, level)[0]!

  expect(room.centre).toEqual({ x: 2000, y: 1500 })
})

test('an L-shaped room puts its centre inside itself, not in the notch', () => {
  const { doc, level } = planWith([
    [0, 0, 6000, 0],
    [6000, 0, 6000, 2000],
    [6000, 2000, 3000, 2000],
    [3000, 2000, 3000, 5000],
    [3000, 5000, 0, 5000],
    [0, 5000, 0, 0],
  ])

  const room = roomsOf(doc, level)[0]!

  expect(room.centre.x).toBeLessThan(3000)
  expect(room.centre.y).toBeLessThan(5000)
})
