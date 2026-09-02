import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { expect, test } from 'vitest'
import { runScript } from './run'

const FLOOR =
  'floor-shape --material natural-oak --kind rectangle --width 12m --depth 9m --name dům'
const house = () => runScript(createEmptyDocument(), FLOOR)
const level = (doc: HouseDocument) => Object.keys(doc.levels)[0]!
const rooms = (doc: HouseDocument) => roomsOf(doc, level(doc))
const walls = (doc: HouseDocument) => Object.values(doc.walls)

test('a wall right across from one side cuts the room in two, and the new part gets a name', () => {
  const doc = runScript(house(), 'add-wall --room dům --side north --along 0.4 --name kuchyň')

  const names = rooms(doc)
    .map((room) => room.name)
    .sort()
  expect(names).toEqual(['dům', 'kuchyň'])
  expect(walls(doc)).toHaveLength(7)
  expect(
    rooms(doc)
      .map((r) => r.area)
      .reduce((a, b) => a + b),
  ).toBe(12_000 * 9000)
})

test('a stub stands with a free end and makes no room', () => {
  const doc = runScript(house(), 'add-wall --room dům --side north --along 0.5 --length 3m')

  expect(rooms(doc)).toHaveLength(1)
  expect(walls(doc)).toHaveLength(6)
  const free = Object.values(doc.nodes).find((node) => node.y === 6000 && node.x === 6000)
  expect(free).toBeDefined()
})

test('two stubs meeting end to end close a room between them: an L-shaped rest', () => {
  const doc = runScript(
    house(),
    [
      'add-wall --room dům --side north --along 0.3333 --length 3m',
      'add-wall --room dům --side west --along 0.6667 --length 4m --name koupelna',
    ].join('\n'),
  )

  const names = rooms(doc)
    .map((room) => room.name)
    .sort()
  expect(names).toEqual(['dům', 'koupelna'])
  const bath = rooms(doc).find((room) => room.name === 'koupelna')!
  // About 4 by 3: the stubs start on the sides' runs, a wall's half-thickness in from the corners.
  expect(bath.area).toBeGreaterThan(11_500_000)
  expect(bath.area).toBeLessThan(12_800_000)
  const rest = rooms(doc).find((room) => room.name === 'dům')!
  expect(rest.nodes).toHaveLength(6)
})

test('a stub let go near a wall is joined to it', () => {
  // 8.9 m of a 9 m room: within reach of the south wall, so it becomes a full partition.
  const doc = runScript(house(), 'add-wall --room dům --side north --along 0.5 --length 8.9m')

  expect(rooms(doc)).toHaveLength(2)
})

test('a wall that runs out of the room, or lies where one is, is refused', () => {
  expect(() =>
    runScript(house(), 'add-wall --room dům --side north --along 0.5 --length 12m'),
  ).toThrow(/runs out of/)
  const stub = runScript(house(), 'add-wall --room dům --side north --along 0.5 --length 3m')
  expect(() => runScript(stub, 'add-wall --room dům --side north --along 0.5 --length 3m')).toThrow(
    /wall there already/,
  )
})

test('a T-shaped room: two corners cut off the same side', () => {
  const doc = runScript(
    house(),
    [
      'add-room --material tile-white --name a --from dům --corner north-west --width 3m --depth 3m',
      'add-room --material tile-white --name b --from dům --corner north-east --width 3m --depth 3m',
    ].join('\n'),
  )

  const t = rooms(doc).find((room) => room.name === 'dům')!
  expect(t.nodes).toHaveLength(8)
  expect(t.area).toBe(12_000 * 9000 - 2 * 3000 * 3000)
})

test('a piece cut off a U keeps its name though its middle is in the gap', () => {
  const doc = runScript(
    createEmptyDocument(),
    [
      'floor-shape --material natural-oak --kind u --width 12m --depth 9m --notch-width 4m --notch-depth 3m --name dům',
      'add-room --material tile-white --name a --from dům --side north --width 4m',
    ].join('\n'),
  )

  expect(
    rooms(doc)
      .map((room) => room.name)
      .sort(),
  ).toEqual(['a', 'dům'])
})
