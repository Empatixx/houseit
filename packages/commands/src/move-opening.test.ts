import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { askScript, runScript } from './run'
import type { RoomReport } from './survey'

const HOUSE = [
  'floor-shape --material natural-oak --kind rectangle --width 12m --depth 9m --name house',
  'add-room --material natural-oak --name kitchen --from house --side west --width 4m',
  'add-door --room kitchen --side east',
  'add-window --room kitchen --side north --along 0.3',
  'add-window --room kitchen --side north --along 0.7',
].join('\n')

const house = () => runScript(createEmptyDocument(), HOUSE)
const kitchen = (doc: HouseDocument) => askScript(doc, 'describe --room kitchen')[0] as RoomReport

test('two windows in one wall are numbered by the order they went in', () => {
  const report = kitchen(house())

  expect(report.windows.map((it) => [it.nth, it.along])).toEqual([
    [1, 0.3],
    [2, 0.7],
  ])
  expect(report.doors[0]!.nth).toBeUndefined()
})

test('a door slid along its wall stays in that wall, where it was told', () => {
  const doc = runScript(house(), 'move-door --room kitchen --side east --along 0.2')

  const door = kitchen(doc).doors[0]!
  expect(door.side).toBe('east')
  expect(door.along).toBeCloseTo(0.2, 1)
})

test('the nth window is the one moved, and a move to another side places it there', () => {
  const doc = runScript(house(), 'move-window --room kitchen --side north --nth 1 --to-side west')

  const report = kitchen(doc)
  expect(report.windows.map((it) => it.side).sort()).toEqual(['north', 'west'])
  expect(report.windows.find((it) => it.side === 'north')!.along).toBeCloseTo(0.7, 1)
})

test('a window cannot be moved onto another, and says so', () => {
  expect(() =>
    runScript(house(), 'move-window --room kitchen --side north --nth 1 --along 0.7'),
  ).toThrow(/already a window/)
})

test('a door cannot be moved to where it could not open', () => {
  const doc = runScript(
    house(),
    'add-object --room kitchen --type sofa-3 --against south --along 0.5',
  )

  expect(() =>
    runScript(doc, 'move-door --room kitchen --side east --to-side south --along 0.5'),
  ).toThrow(/could not open/)
})

test('a move has to say where, and a door that is not there is refused by name', () => {
  expect(() => runScript(house(), 'move-door --room kitchen --side east')).toThrow(/say where/)
  expect(() => runScript(house(), 'move-door --room kitchen --side west --along 0.5')).toThrow(
    /no door in the west wall/,
  )
  expect(() =>
    runScript(house(), 'move-window --room kitchen --side north --nth 3 --along 0.5'),
  ).toThrow(/there are 2/)
})

test('remove takes the nth one out, and the last without a number', () => {
  const doc = runScript(house(), 'remove-window --room kitchen --side north --nth 1')
  expect(kitchen(doc).windows.map((it) => it.along)).toEqual([0.7])

  const gone = runScript(doc, 'remove-window --room kitchen --side north')
  expect(kitchen(gone).windows).toEqual([])
})

test('an opening put exactly where it is asked for lands there', () => {
  const doc = runScript(house(), 'add-door --room kitchen --side south --along 0.25')
  const door = kitchen(doc).doors.find((it) => it.side === 'south')!
  expect(door.along).toBeCloseTo(0.25, 1)

  expect(() =>
    runScript(doc, 'add-window --room kitchen --side south --width 6m --along 0.9'),
  ).toThrow(/runs past the end/)
})
