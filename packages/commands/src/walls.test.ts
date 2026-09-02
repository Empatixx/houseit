import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { expect, test } from 'vitest'
import { askScript, runScript } from './run'
import type { RoomReport } from './survey'

const HOUSE = [
  'floor-shape --material natural-oak --kind rectangle --width 12m --depth 9m --name house',
  'add-room --material natural-oak --name kitchen --from house --side west --width 4m',
  'add-room --material natural-oak --name hall --from house --side north --width 1.5m',
  'add-door --room house --side south',
  'add-door --room kitchen --side east',
  'add-window --room kitchen --side north --along 0.5',
].join('\n')

const house = () => runScript(createEmptyDocument(), HOUSE)
const level = (doc: HouseDocument) => Object.keys(doc.levels)[0]!
const report = (doc: HouseDocument, name: string) =>
  askScript(doc, `describe --room "${name}"`)[0] as RoomReport

test('a wall moved outward makes the room bigger and the room beyond it smaller', () => {
  const before = { kitchen: report(house(), 'kitchen'), house: report(house(), 'house') }

  const doc = runScript(house(), 'move-wall --room kitchen --side east --by 1m')

  const after = { kitchen: report(doc, 'kitchen'), house: report(doc, 'house') }
  expect(after.kitchen.width - before.kitchen.width).toBe(1000)
  expect(before.house.width - after.house.width).toBe(1000)
  // The house still has its rooms and its walls meet.
  expect(roomsOf(doc, level(doc))).toHaveLength(3)
})

test('the whole line moves, so the wall carrying on beyond stays straight', () => {
  // The kitchen's east wall runs on north into the hall's partition: both move.
  const doc = runScript(house(), 'move-wall --room kitchen --side east --by 500')

  const nodes = Object.values(doc.nodes).map((node) => node.x)
  expect(nodes.filter((x) => x === 4000)).toHaveLength(0)
  expect(nodes.filter((x) => x === 4500).length).toBeGreaterThanOrEqual(2)
})

test('a door in the moved wall goes with it; a window in a stretched wall keeps its distance', () => {
  const before = report(house(), 'kitchen')
  const doc = runScript(house(), 'move-wall --room kitchen --side east --by 1m')
  const after = report(doc, 'kitchen')

  // The door is in the wall that moved: the same place along it as before.
  expect(after.doors.find((it) => it.side === 'east')?.along).toBeCloseTo(
    before.doors.find((it) => it.side === 'east')!.along,
    2,
  )
  // The window is in the north wall, which stretched: the same distance from the west corner.
  const was = before.windows[0]!.along * before.width
  const is = after.windows[0]!.along * after.width
  expect(Math.abs(is - was)).toBeLessThan(20)
})

test('a wall cannot be moved through the room on the other side', () => {
  expect(() => runScript(house(), 'move-wall --room kitchen --side east --by 9m')).toThrow(
    /would leave the wall/,
  )
})

test('a wall cannot be moved so that what stands in the room no longer fits', () => {
  const doc = runScript(
    house(),
    [
      'remove-window --room kitchen --side north',
      'add-object --room kitchen --type refrigerator --against north --along 0.2',
      'add-object --room kitchen --type stove --against north --along 0.8',
    ].join('\n'),
  )

  expect(() => runScript(doc, 'move-wall --room kitchen --side east --by -2.5m')).toThrow(
    /refrigerator|stove/,
  )
})

test('rooms keep their names when a wall moves past an anchor', () => {
  const doc = runScript(
    house(),
    'remove-window --room kitchen --side north\nmove-wall --room kitchen --side east --by -3.5m',
  )

  const names = roomsOf(doc, level(doc))
    .map((room) => room.name)
    .sort()
  expect(names).toEqual(['hall', 'house', 'kitchen'])
  expect(report(doc, 'kitchen').width).toBeLessThan(1000)
})

test('a window that would be pushed off the end of its wall stops the move', () => {
  expect(() => runScript(house(), 'move-wall --room kitchen --side east --by -3.5m')).toThrow(
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
  // The fridge was against the kitchen's north wall, which is still the merged room's north wall.
  const fridge = merged.objects.find((it) => it.type === 'refrigerator')!
  expect(fridge.against).toBe('north')
  expect(fridge.at!.x).toBeLessThan(4000)
  // The door between them went with the wall; the front door stayed.
  expect(merged.doors.map((it) => it.side)).toEqual(['south'])
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
  const moved = runScript(doc, 'move-wall --room kitchen --side east --by 1m')
  const after = report(moved, 'house')

  const sofa = (r: RoomReport) => r.objects.find((it) => it.type === 'sofa-3')!.at!
  const shelf = (r: RoomReport) => r.objects.find((it) => it.type === 'bookshelf')!.at!
  // The sofa is against the south wall, which stayed: the same spot.
  expect(Math.abs(sofa(after).x - sofa(before).x)).toBeLessThan(20)
  // The bookshelf is against the west wall, which moved a metre east: it went along.
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
  // Its back was on the face of the partition at 4000, less half the wall.
  expect(shelf.at!.x).toBeGreaterThan(3500)
  expect(shelf.at!.x).toBeLessThan(3850)
})

test('what stood in the room knocked into stays put as well', () => {
  // A bookshelf in the house against the partition it shares with the kitchen.
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
