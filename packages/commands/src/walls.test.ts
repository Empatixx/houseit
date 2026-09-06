import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { expect, test } from 'vitest'
import { askPlan } from './answer'
import { runScript } from './run'
import type { RoomReport } from './survey'

const doorsOf = (room: RoomReport) => room.openings.filter((it) => it.kind === 'door')
const windowsOf = (room: RoomReport) => room.openings.filter((it) => it.kind === 'window')

const HOUSE = [
  'add-room --material natural-oak --shape rectangle --width 12m --depth 9m --name house',
  'add-room --material natural-oak --name kitchen --from house --side west --width 4m',
  'add-room --material natural-oak --name hall --from house --side north --width 1.5m',
  'add-opening --kind door --room house --side south',
  'add-opening --kind door --room kitchen --side east',
  'add-opening --kind window --room kitchen --side north --along 0.5',
].join('\n')

const house = () => runScript(createEmptyDocument(), HOUSE)
const openingIn = (doc: HouseDocument, name: string, kind: 'door' | 'window') =>
  askPlan(doc, `get-plan --room ${name}`).rooms[0]!.openings.find((it) => it.kind === kind)!.id
const level = (doc: HouseDocument) => Object.keys(doc.levels)[0]!
const report = (doc: HouseDocument, name: string) =>
  askPlan(doc, `get-plan --room "${name}"`).rooms[0]!

test('a wall moved outward makes the room bigger and the room beyond it smaller', () => {
  const before = { kitchen: report(house(), 'kitchen'), house: report(house(), 'house') }

  const doc = runScript(house(), 'update-room --room kitchen --side east --by 1m')

  const after = { kitchen: report(doc, 'kitchen'), house: report(doc, 'house') }
  expect(after.kitchen.width - before.kitchen.width).toBe(1000)
  expect(before.house.width - after.house.width).toBe(1000)
  expect(roomsOf(doc, level(doc))).toHaveLength(3)
})

test('the whole line moves, so the wall carrying on beyond stays straight', () => {
  const doc = runScript(house(), 'update-room --room kitchen --side east --by 500')

  const nodes = Object.values(doc.nodes).map((node) => node.x)
  expect(nodes.filter((x) => x === 4000)).toHaveLength(0)
  expect(nodes.filter((x) => x === 4500).length).toBeGreaterThanOrEqual(2)
})

test('a door in the moved wall goes with it; a window in a stretched wall keeps its distance', () => {
  const before = report(house(), 'kitchen')
  const doc = runScript(house(), 'update-room --room kitchen --side east --by 1m')
  const after = report(doc, 'kitchen')

  expect(doorsOf(after).find((it) => it.side === 'east')?.along).toBeCloseTo(
    doorsOf(before).find((it) => it.side === 'east')!.along,
    2,
  )
  const was = windowsOf(before)[0]!.along * before.width
  const is = windowsOf(after)[0]!.along * after.width
  expect(Math.abs(is - was)).toBeLessThan(20)
})

test('a wall cannot be moved through the room on the other side', () => {
  expect(() => runScript(house(), 'update-room --room kitchen --side east --by 9m')).toThrow(
    /would leave the wall/,
  )
})

test('a wall cannot be moved so that what stands in the room no longer fits', () => {
  const doc = runScript(
    house(),
    [
      `remove-opening --id ${openingIn(house(), 'kitchen', 'window')}`,
      'add-object --room kitchen --type refrigerator --against north --along 0.2',
      'add-object --room kitchen --type stove --against north --along 0.8',
    ].join('\n'),
  )

  expect(() => runScript(doc, 'update-room --room kitchen --side east --by -2.5m')).toThrow(
    /refrigerator|stove/,
  )
})

test('rooms keep their names when a wall moves past an anchor', () => {
  const doc = runScript(
    house(),
    [
      `remove-opening --id ${openingIn(house(), 'kitchen', 'window')}`,
      'update-room --room kitchen --side east --by -3.5m',
    ].join('\n'),
  )

  const names = roomsOf(doc, level(doc))
    .map((room) => room.name)
    .sort()
  expect(names).toEqual(['hall', 'house', 'kitchen'])
  expect(report(doc, 'kitchen').width).toBeLessThan(1000)
})

test('a window that would be pushed off the end of its wall stops the move', () => {
  expect(() => runScript(house(), 'update-room --room kitchen --side east --by -3.5m')).toThrow(
    /window .* pushed off its end/,
  )
})

test('a room knocked through into its neighbour is gone, and its things stand where they stood', () => {
  const doc = runScript(
    house(),
    [
      'add-object --room kitchen --type refrigerator --against north',
      'remove-room --room kitchen --into house',
    ].join('\n'),
  )

  const names = roomsOf(doc, level(doc))
    .map((room) => room.name)
    .sort()
  expect(names).toEqual(['hall', 'house'])
  const merged = report(doc, 'house')
  expect(merged.width).toBeGreaterThan(11_000)
  const fridge = merged.objects.find((it) => it.type === 'refrigerator')!
  expect(fridge.against).toBe('north')
  expect(fridge.at!.x).toBeLessThan(4000)
  expect(doorsOf(merged).map((it) => it.side)).toEqual(['south'])
})

test('a room shares no wall with a room across the house', () => {
  const doc = runScript(
    house(),
    'add-room --material natural-oak --name study --from house --side east --width 3m',
  )

  expect(() => runScript(doc, 'remove-room --room kitchen --into study')).toThrow(/share no wall/)
  expect(() => runScript(doc, 'remove-room --room kitchen --into kitchen')).toThrow(/into itself/)
})

test('what stands against another wall stays put when this one moves; what stands against this one goes with it', () => {
  const doc = runScript(
    house(),
    [
      'add-object --room house --type sofa-3 --against south --along 0.5',
      'add-object --room house --type bookshelf --against west --along 0.5',
    ].join('\n'),
  )
  const before = report(doc, 'house')
  const moved = runScript(doc, 'update-room --room kitchen --side east --by 1m')
  const after = report(moved, 'house')

  const sofa = (r: RoomReport) => r.objects.find((it) => it.type === 'sofa-3')!.at!
  const shelf = (r: RoomReport) => r.objects.find((it) => it.type === 'bookshelf')!.at!
  expect(Math.abs(sofa(after).x - sofa(before).x)).toBeLessThan(20)
  expect(shelf(after).x - shelf(before).x).toBeCloseTo(1000, -1)
})

test('a thing against the wall that went stands free where it stood', () => {
  const doc = runScript(
    house(),
    [
      'add-object --room kitchen --type bookshelf --against east --along 0.3',
      'remove-room --room kitchen --into house',
    ].join('\n'),
  )

  const shelf = report(doc, 'house').objects.find((it) => it.type === 'bookshelf')!
  expect(shelf.against).toBeUndefined()
  expect(shelf.at!.x).toBeGreaterThan(3500)
  expect(shelf.at!.x).toBeLessThan(3850)
})

test('what stood in the room knocked into stays put as well', () => {
  const doc = runScript(
    house(),
    [
      'add-object --room house --type bookshelf --against west --along 0.3',
      'remove-room --room kitchen --into house',
    ].join('\n'),
  )

  const shelf = report(doc, 'house').objects.find((it) => it.type === 'bookshelf')!
  expect(shelf.against).toBeUndefined()
  expect(shelf.at!.x).toBeGreaterThan(4100)
  expect(shelf.at!.x).toBeLessThan(4500)
})
