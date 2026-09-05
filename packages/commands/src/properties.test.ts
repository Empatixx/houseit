import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { expect, test } from 'vitest'
import { askPlan, runScript } from './run'

const HOUSE = [
  'add-room --material natural-oak --shape rectangle --width 12m --depth 9m --name house',
  'add-room --material natural-oak --name snug --from house --side west --width 4m',
  'add-opening --kind door --room house --side south',
  'add-opening --kind door --room snug --side east',
  'add-opening --kind window --room snug --side north',
  'add-object --room snug --type sofa-3 --against south',
].join('\n')

const house = () => runScript(createEmptyDocument(), HOUSE)
const level = (doc: HouseDocument) => Object.keys(doc.levels)[0]!
const room = (doc: HouseDocument, name: string) =>
  roomsOf(doc, level(doc)).find((it) => it.name === name)
const sofa = (doc: HouseDocument) => Object.values(doc.objects).find((it) => it.type === 'sofa-3')!
const windowIn = (doc: HouseDocument) =>
  Object.values(doc.openings).find((it) => it.kind === 'window')!
const doorOn = (doc: HouseDocument, side: 'east' | 'south') =>
  askPlan(doc, 'get-plan').rooms.flatMap((room) =>
    room.openings.filter((it) => it.kind === 'door' && it.side === side),
  )[0]!

test('a room renamed is found by its new name, and keeps its floor', () => {
  const doc = runScript(house(), 'update-room --room snug --name den')

  expect(room(doc, 'snug')).toBeUndefined()
  expect(room(doc, 'den')?.floor).toBe('natural-oak')
  expect(() => runScript(doc, 'update-room --room den --name house')).toThrow(
    /already a room called house/,
  )
})

test('a room told its kind is checked as that kind, whatever its name', () => {
  const before = askPlan(house(), 'get-plan')
  expect(before.problems.map((it) => it.code)).not.toContain('kitchen.incomplete')

  const doc = runScript(house(), 'update-room --room snug --kind kitchen')
  const report = askPlan(doc, 'get-plan --room snug').rooms[0]!
  expect(report.kind).toBe('kitchen')
  // Told it is a kitchen, the snug is now owed a sink, a stove and a fridge.
  const after = askPlan(doc, 'get-plan')
  expect(after.problems.map((it) => `${it.code}:${it.room}`)).toContain('kitchen.incomplete:snug')
})

test('a thing takes another finish, but only one its type comes in', () => {
  const id = sofa(house()).id
  const doc = runScript(house(), `update-object --id ${id} --surface linen`)
  expect(sofa(doc).surface).toBe('linen')

  expect(() => runScript(doc, `update-object --id ${id} --surface oak`)).toThrow(
    /does not come in oak/,
  )
})

test('a thing resized where it stands, unless it no longer fits there', () => {
  const id = sofa(house()).id
  const doc = runScript(house(), `update-object --id ${id} --width 2.6m`)
  expect(sofa(doc).width).toBe(2600)

  expect(() => runScript(doc, `update-object --id ${id} --width 5m`)).toThrow(
    /a 5000 by \d+ mm 3-seat sofa does not fit where it stands/,
  )
  expect(() => runScript(doc, `update-object --id ${id}`)).toThrow(/say what to change/)
})

test('a size, a turn and a finish in one line are checked on the thing they make together', () => {
  const id = sofa(house()).id

  // Each on its own would pass: 2.4 m fits the wall, and the sofa can turn on
  // the spot. Turned across a 950 mm wall, a 2.4 m sofa cannot.
  expect(() => runScript(house(), `update-object --id ${id} --width 2.4m`)).not.toThrow()
  const doc = runScript(
    house(),
    `update-object --id ${id} --width 2.4m --rotation 90 --surface linen`,
  )

  // Refused as one, or allowed as one — either way it is the same one check.
  expect(doc.objects[id]!.rotation).toBe(90)
  expect(doc.objects[id]!.surface).toBe('linen')
})

test('a turn is a field of the thing, set to a number rather than nudged by one', () => {
  const id = sofa(house()).id
  const doc = runScript(house(), `update-object --id ${id} --rotation 30`)
  expect(doc.objects[id]!.rotation).toBe(30)

  // And back to square on, which is no turn at all rather than a turn of zero.
  const straight = runScript(doc, `update-object --id ${id} --rotation 0`)
  expect('rotation' in straight.objects[id]!).toBe(false)
})

test('a window made wider, and refused when it would not fit its wall', () => {
  const id = windowIn(house()).id
  const doc = runScript(house(), `update-opening --id ${id} --width 2m --sill 600`)
  expect(windowIn(doc).width).toBe(2000)
  expect(windowIn(doc).sillHeight).toBe(600)

  expect(() => runScript(doc, `update-opening --id ${id} --width 5m`)).toThrow(/runs past the end/)
  expect(() => runScript(doc, `update-opening --id ${id}`)).toThrow(/say what to change/)
})

test('a window has no leaf and a door has no sill, and asking for either says so', () => {
  const window_ = windowIn(house()).id
  const door = doorOn(house(), 'east').id

  expect(() => runScript(house(), `update-opening --id ${window_} --variant pocket`)).toThrow(
    /a window has no leaf/,
  )
  expect(() => runScript(house(), `update-opening --id ${door} --sill 600`)).toThrow(
    /starts on the floor/,
  )
})

test('a door made a pocket door stops swinging, and made hinged again has to be able to', () => {
  const id = doorOn(house(), 'east').id
  const pocket = runScript(house(), `update-opening --id ${id} --variant pocket`)
  expect(pocket.openings[id]!.variant).toBe('pocket')

  // Something in the swing: fine for a pocket door, not for a hinged one.
  const blocked = runScript(
    pocket,
    'add-object --room snug --type bookshelf --against east --along 0.5',
  )
  expect(() => runScript(blocked, `update-opening --id ${id} --variant hinged`)).toThrow(
    /could not open/,
  )
})
