import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { expect, test } from 'vitest'
import { askScript, runScript } from './run'
import type { RoomReport } from './survey'

/**
 * Rooms that are not rectangles, and the walls of them that a side alone
 * cannot name: an L has two north walls, and the inner one has to be
 * reachable by id — for a door, a window, a thing against it, a tape on it.
 */

const level = (doc: HouseDocument) => Object.keys(doc.levels)[0]!
const named = (doc: HouseDocument, name: string) =>
  roomsOf(doc, level(doc)).find((room) => room.name === name)
const report = (doc: HouseDocument, name: string) =>
  askScript(doc, `describe --room "${name}"`)[0] as RoomReport

const RECT = 'floor-shape --material natural-oak --kind rectangle --width 12m --depth 9m --name dům'
const L_FLOOR =
  'floor-shape --material natural-oak --kind l --width 12m --depth 9m --notch-width 4m --notch-depth 3m --name dům'

test('an L has six walls, two of them on one side, told apart by number and id', () => {
  const doc = runScript(createEmptyDocument(), L_FLOOR)
  const walls = report(doc, 'dům').walls

  expect(walls).toHaveLength(6)
  expect(walls.every((wall) => /^w\d+$/.test(wall.id))).toBe(true)
  const doubled = walls.filter((wall) => wall.nth !== undefined)
  expect(doubled).toHaveLength(4)
  const sides = new Set(doubled.map((wall) => wall.side))
  expect(sides.size).toBe(2)
  for (const side of sides) {
    const numbers = doubled.filter((wall) => wall.side === side).map((wall) => wall.nth)
    expect([...numbers].sort()).toEqual([1, 2])
  }
})

test('a door goes into the inner wall of an L by its id, and describe says so', () => {
  const doc = runScript(createEmptyDocument(), L_FLOOR)
  const walls = report(doc, 'dům').walls
  const inner = walls.find((wall) => wall.nth !== undefined && wall.length === 3000)!

  const next = runScript(doc, `add-door --room dům --wall ${inner.id}`)
  const doors = report(next, 'dům').doors

  expect(doors).toHaveLength(1)
  expect(doors[0]!.wall).toBe(inner.id)
  expect(doors[0]!.side).toBe(inner.side)
})

test('a thing stands against the inner wall of an L by its id', () => {
  const doc = runScript(createEmptyDocument(), L_FLOOR)
  const walls = report(doc, 'dům').walls
  const inner = walls.find((wall) => wall.nth !== undefined && wall.length === 3000)!

  const next = runScript(doc, `add-object --room dům --type bookshelf --wall ${inner.id}`)
  const shelf = report(next, 'dům').objects[0]!

  expect(shelf.against).toBe(inner.side)
  expect(shelf.wall).toBe(inner.id)
  const tape = askScript(next, `measure --room dům --wall ${inner.id}`)[0] as {
    walls: string[]
    objects: { id: string }[]
  }
  expect(tape.walls).toContain(inner.id)
  expect(tape.objects.map((it) => it.id)).toEqual([shelf.id])
})

test('a room can be any shape, said by its corners, and the areas still add up', () => {
  const doc = runScript(createEmptyDocument(), RECT)
  const whole = named(doc, 'dům')!.area

  const next = runScript(
    doc,
    'add-room --name kuchyň --material natural-oak --points "0,0; 5m,0; 5m,3m; 3m,3m; 3m,5m; 0,5m"',
  )

  expect(roomsOf(next, level(next))).toHaveLength(2)
  expect(named(next, 'kuchyň')?.area).toBe(5000 * 3000 + 3000 * 2000)
  expect(named(next, 'dům')?.area).toBe(whole - (5000 * 3000 + 3000 * 2000))
  expect(report(next, 'kuchyň').walls).toHaveLength(6)
})

test('a room can be walked round from a side of the room it comes out of', () => {
  const doc = runScript(createEmptyDocument(), RECT)

  const next = runScript(
    doc,
    'add-room --name spíž --material natural-oak --from dům --side north --along 0 --walk "3m s, 4m e, 3m n"',
  )

  expect(roomsOf(next, level(next))).toHaveLength(2)
  expect(named(next, 'spíž')?.area).toBe(4000 * 3000)
  expect(named(next, 'dům')?.area).toBe(12_000 * 9000 - 4000 * 3000)
})

test('along takes a length as well as a fraction', () => {
  const doc = runScript(createEmptyDocument(), RECT)

  const next = runScript(
    doc,
    [
      'add-window --room dům --side south --along 2.4m',
      'add-window --room dům --side south --along -1m',
    ].join('\n'),
  )
  const windows = report(next, 'dům').windows

  expect(windows).toHaveLength(2)
  // 2.4 m from the west end of a run that starts 150 mm in from the corner.
  expect(windows[0]!.along * (12_000 - 300)).toBeCloseTo(2400, -1)
  expect(windows[1]!.along).toBeGreaterThan(0.9)
})

test('everything has an id, and a thing is reached by it', () => {
  const doc = runScript(
    createEmptyDocument(),
    [RECT, 'add-object --room dům --type sofa-3 --against south'].join('\n'),
  )
  const room = report(doc, 'dům')
  const sofa = room.objects[0]!

  expect(room.id).toMatch(/^r\d+$/)
  expect(sofa.id).toMatch(/^f\d+$/)
  const next = runScript(doc, `move-object --id ${sofa.id} --against north`)
  expect(report(next, 'dům').objects[0]!.against).toBe('north')
  const gone = runScript(next, `remove-object --id ${sofa.id}`)
  expect(report(gone, 'dům').objects).toHaveLength(0)
})
