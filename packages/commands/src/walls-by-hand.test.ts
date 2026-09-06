import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { expect, test } from 'vitest'
import { drawWall } from './draw-wall'
import { applyCommand, runScript } from './run'
import { removeWall, resizeWall } from './stub-commands'

const FLOOR = 'add-room --material natural-oak --shape rectangle --width 12m --depth 9m --name dům'
const level = (doc: HouseDocument) => Object.keys(doc.levels)[0]!
const rooms = (doc: HouseDocument) => roomsOf(doc, level(doc))
const walls = (doc: HouseDocument) => Object.values(doc.walls)

const withStub = () =>
  applyCommand(runScript(createEmptyDocument(), FLOOR), drawWall, {
    room: 'dům',
    side: 'north',
    along: 0.5,
    walk: '3m s',
  })

test('a walk on empty paper that comes back on itself is a room', () => {
  const doc = applyCommand(createEmptyDocument(), drawWall, {
    at: '0,0',
    walk: '8m e, 6m n, 8m w, 6m s',
    name: 'chata',
    material: 'natural-oak',
  })

  expect(rooms(doc)).toHaveLength(1)
  expect(rooms(doc)[0]).toMatchObject({ name: 'chata', floor: 'natural-oak' })
  expect(rooms(doc)[0]!.area).toBe(8000 * 6000)
  expect(walls(doc)).toHaveLength(4)
})

test('a leg from one side right across cuts the room in two, with the corners joined', () => {
  const doc = applyCommand(runScript(createEmptyDocument(), FLOOR), drawWall, {
    room: 'dům',
    side: 'north',
    along: 0.5,
    walk: '9m s',
    name: 'kuchyň',
  })

  expect(
    rooms(doc)
      .map((room) => room.name)
      .sort(),
  ).toEqual(['dům', 'kuchyň'])
  expect(walls(doc)).toHaveLength(7)
  expect(rooms(doc).reduce((total, room) => total + room.area, 0)).toBe(12_000 * 9000)
})

test('a leg that stops short is a stub, and closes no room', () => {
  const doc = withStub()

  expect(rooms(doc)).toHaveLength(1)
  expect(walls(doc)).toHaveLength(6)
})

test('a stub is taken out, and the wall it hung from is whole again', () => {
  const doc = applyCommand(withStub(), removeWall, { room: 'dům', side: 'north', along: 0.5 })

  expect(walls(doc)).toHaveLength(4)
  expect(Object.values(doc.nodes)).toHaveLength(4)
  expect(rooms(doc)).toHaveLength(1)
})

test('a stub is named by where it hangs, near enough', () => {
  const at = (along: number) =>
    applyCommand(withStub(), removeWall, { room: 'dům', side: 'north', along })

  expect(() => at(0.52)).not.toThrow()
  expect(() => at(0.2)).toThrow(/there is one at 0.5/)
  expect(() =>
    applyCommand(withStub(), removeWall, { room: 'dům', side: 'south', along: 0.5 }),
  ).toThrow(/no wall stub hangs off the south side/)
})

test('a stub made longer stays a stub; long enough, it reaches the far wall', () => {
  const longer = applyCommand(withStub(), resizeWall, {
    room: 'dům',
    side: 'north',
    along: 0.5,
    length: 5000,
  })
  expect(rooms(longer)).toHaveLength(1)
  expect(
    Object.values(longer.nodes).find((node) => node.x === 6000 && node.y === 4000),
  ).toBeDefined()

  const across = applyCommand(withStub(), resizeWall, {
    room: 'dům',
    side: 'north',
    along: 0.5,
    length: 8900,
  })
  expect(rooms(across)).toHaveLength(2)
})

test('a wall with both ends attached is not a stub, and says so', () => {
  const cut = applyCommand(runScript(createEmptyDocument(), FLOOR), drawWall, {
    room: 'dům',
    side: 'north',
    along: 0.5,
    walk: '9m s',
  })

  expect(() => applyCommand(cut, removeWall, { room: 'dům', side: 'north', along: 0.5 })).toThrow(
    /no wall stub/,
  )
})
