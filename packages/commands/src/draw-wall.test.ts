import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { expect, test } from 'vitest'
import { runScript } from './run'

const FLOOR =
  'floor-shape --material natural-oak --kind rectangle --width 12m --depth 9m --name dům'
const level = (doc: HouseDocument) => Object.keys(doc.levels)[0]!
const rooms = (doc: HouseDocument) => roomsOf(doc, level(doc))
const walls = (doc: HouseDocument) => Object.values(doc.walls)

test('a walk on empty paper that comes back on itself is a room', () => {
  const doc = runScript(
    createEmptyDocument(),
    'draw-wall --at 0,0 --walk "8m e, 6m n, 8m w, 6m s" --name chata --material natural-oak',
  )

  expect(rooms(doc)).toHaveLength(1)
  expect(rooms(doc)[0]).toMatchObject({ name: 'chata', floor: 'natural-oak' })
  expect(rooms(doc)[0]!.area).toBe(8000 * 6000)
  expect(walls(doc)).toHaveLength(4)
})

test('a leg from one side of a room right across cuts it in two, with the corners joined', () => {
  const doc = runScript(
    createEmptyDocument(),
    `${FLOOR}\ndraw-wall --room dům --side north --along 0.5 --walk "9m s" --name kuchyň`,
  )

  expect(
    rooms(doc)
      .map((room) => room.name)
      .sort(),
  ).toEqual(['dům', 'kuchyň'])
  expect(walls(doc)).toHaveLength(7)
  expect(
    rooms(doc)
      .map((r) => r.area)
      .reduce((a, b) => a + b),
  ).toBe(12_000 * 9000)
})

test('a leg that stops short is a stub; a turn makes an L round a corner of a room', () => {
  const stub = runScript(
    createEmptyDocument(),
    `${FLOOR}\ndraw-wall --room dům --side north --along 0.5 --walk "3m s"`,
  )
  expect(rooms(stub)).toHaveLength(1)
  // The outline wall it hangs from is split at its root: five outline walls and the stub.
  expect(walls(stub)).toHaveLength(6)

  const elbow = runScript(
    createEmptyDocument(),
    `${FLOOR}\ndraw-wall --room dům --side north --along 0.3333 --walk "3m s, 4m w" --name koupelna`,
  )
  expect(
    rooms(elbow)
      .map((room) => room.name)
      .sort(),
  ).toEqual(['dům', 'koupelna'])
  // The second leg ends on the west wall, which it is joined to: a room closes.
  const bath = rooms(elbow).find((room) => room.name === 'koupelna')!
  expect(bath.area).toBeGreaterThan(11_000_000)
})

test('a leg drawn across two rooms is a partition in each, meeting the wall between as a T', () => {
  const two = runScript(
    createEmptyDocument(),
    `${FLOOR}\nadd-room --material natural-oak --name kuchyň --from dům --side west --width 4m`,
  )
  const doc = runScript(
    two,
    'draw-wall --room kuchyň --side north --along 0.5 --walk "4.5m s, 10m e" --name x',
  )

  // The east-going leg starts inside the kitchen, crosses the partition and ends near the east wall.
  expect(rooms(doc).length).toBeGreaterThanOrEqual(3)
  const total = rooms(doc)
    .map((r) => r.area)
    .reduce((a, b) => a + b)
  expect(total).toBe(12_000 * 9000)
})

test('an end let go near a wall is joined to it', () => {
  const doc = runScript(
    createEmptyDocument(),
    `${FLOOR}\ndraw-wall --room dům --side north --along 0.5 --walk "8.9m s"`,
  )

  expect(rooms(doc)).toHaveLength(2)
})

test('a walk needs somewhere to start, and a walk along a wall that is there draws nothing', () => {
  expect(() => runScript(createEmptyDocument(), 'draw-wall --walk "3m e"')).toThrow(
    /where to start/,
  )
  expect(() =>
    runScript(createEmptyDocument(), `${FLOOR}\ndraw-wall --at 0,0 --walk "12m e"`),
  ).toThrow(/walls there already/)
})
