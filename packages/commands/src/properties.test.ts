import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { expect, test } from 'vitest'
import type { Problem } from './check-plan'
import { askScript, runScript } from './run'
import type { RoomReport } from './survey'

const HOUSE = [
  'floor-shape --material natural-oak --kind rectangle --width 12m --depth 9m --name house',
  'add-room --material natural-oak --name snug --from house --side west --width 4m',
  'add-door --room house --side south',
  'add-door --room snug --side east',
  'add-window --room snug --side north',
  'add-object --room snug --type sofa-3 --against south',
].join('\n')

const house = () => runScript(createEmptyDocument(), HOUSE)
const level = (doc: HouseDocument) => Object.keys(doc.levels)[0]!
const room = (doc: HouseDocument, name: string) =>
  roomsOf(doc, level(doc)).find((it) => it.name === name)
const sofa = (doc: HouseDocument) => Object.values(doc.objects).find((it) => it.type === 'sofa-3')!

test('a room renamed is found by its new name, and keeps its floor', () => {
  const doc = runScript(house(), 'rename-room --room snug --name den')

  expect(room(doc, 'snug')).toBeUndefined()
  expect(room(doc, 'den')?.floor).toBe('natural-oak')
  expect(() => runScript(doc, 'rename-room --room den --name house')).toThrow(
    /already a room called house/,
  )
})

test('a room told its kind is checked as that kind, whatever its name', () => {
  const before = askScript(house(), 'check-plan')[0] as { problems: Problem[] }
  expect(before.problems.map((it) => it.code)).not.toContain('kitchen.incomplete')

  const doc = runScript(house(), 'set-room-kind --room snug --kind kitchen')
  const report = askScript(doc, 'describe --room snug')[0] as RoomReport
  expect(report.kind).toBe('kitchen')
  // Told it is a kitchen, the snug is now owed a sink, a stove and a fridge.
  const after = askScript(doc, 'check-plan')[0] as { problems: Problem[] }
  expect(after.problems.map((it) => `${it.code}:${it.room}`)).toContain('kitchen.incomplete:snug')
})

test('a thing takes another finish, but only one its type comes in', () => {
  const doc = runScript(house(), 'set-surface --room snug --type sofa-3 --surface linen')
  expect(sofa(doc).surface).toBe('linen')

  expect(() => runScript(doc, 'set-surface --room snug --type sofa-3 --surface oak')).toThrow(
    /does not come in oak/,
  )
})

test('a thing resized where it stands, unless it no longer fits there', () => {
  const doc = runScript(house(), 'resize-object --room snug --type sofa-3 --width 2.6m')
  expect(sofa(doc).width).toBe(2600)

  expect(() => runScript(doc, 'resize-object --room snug --type sofa-3 --width 5m')).toThrow(
    /does not fit where it stands/,
  )
  expect(() => runScript(doc, 'resize-object --room snug --type sofa-3')).toThrow(/say a --width/)
})

test('a window made wider, and refused when it would not fit its wall', () => {
  const doc = runScript(house(), 'set-window --room snug --side north --width 2m --sill 600')
  const window = Object.values(doc.openings).find((it) => it.kind === 'window')!
  expect(window.width).toBe(2000)
  expect(window.sillHeight).toBe(600)

  expect(() => runScript(doc, 'set-window --room snug --side north --width 5m')).toThrow(
    /runs past the end/,
  )
})

test('a door made a pocket door stops swinging, and made hinged again has to be able to', () => {
  const pocket = runScript(house(), 'set-door --room snug --side east --variant pocket')
  const door = Object.values(pocket.openings).find(
    (it) => it.kind === 'door' && it.variant === 'pocket',
  )
  expect(door).toBeDefined()

  // Something in the swing: fine for a pocket door, not for a hinged one.
  const blocked = runScript(
    pocket,
    'add-object --room snug --type bookshelf --against east --along 0.5',
  )
  expect(() => runScript(blocked, 'set-door --room snug --side east --variant hinged')).toThrow(
    /could not open/,
  )
})
