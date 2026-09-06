import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { askPlan } from './answer'
import { runScript } from './run'
import type { OpeningReport, RoomReport } from './survey'

const HOUSE = [
  'add-room --material natural-oak --shape rectangle --width 12m --depth 9m --name house',
  'add-room --material natural-oak --name kitchen --from house --side west --width 4m',
  'add-opening --kind door --room kitchen --side east',
  'add-opening --kind window --room kitchen --side north --along 0.3',
  'add-opening --kind window --room kitchen --side north --along 0.7',
].join('\n')

const house = () => runScript(createEmptyDocument(), HOUSE)
const kitchen = (doc: HouseDocument): RoomReport =>
  askPlan(doc, 'get-plan --room kitchen').rooms[0]!
const openingsOf = (doc: HouseDocument, kind: 'door' | 'window'): OpeningReport[] =>
  kitchen(doc).openings.filter((it) => it.kind === kind)

const ids = () => askPlan(createEmptyDocument(), HOUSE).changed.filter((id) => id.startsWith('o'))

test('every opening comes back with an id, and that is how the next command names it', () => {
  const [door, first, second] = ids()

  expect(openingsOf(house(), 'window').map((it) => [it.id, it.along])).toEqual([
    [first, 0.3],
    [second, 0.7],
  ])
  expect(openingsOf(house(), 'door')[0]!.id).toBe(door)
})

test('a door slid along its wall stays in that wall, where it was told', () => {
  const [door] = ids()
  const doc = runScript(house(), `update-opening --id ${door} --along 0.2`)

  const moved = openingsOf(doc, 'door')[0]!
  expect(moved.side).toBe('east')
  expect(moved.along).toBeCloseTo(0.2, 1)
})

test('the one named by id is the one moved, and a move to another side places it there', () => {
  const [, first] = ids()
  const doc = runScript(house(), `update-opening --id ${first} --to-side west`)

  const windows = openingsOf(doc, 'window')
  expect(windows.map((it) => it.side).sort()).toEqual(['north', 'west'])
  expect(windows.find((it) => it.side === 'north')!.along).toBeCloseTo(0.7, 1)
})

test('a window cannot be moved onto another, and says so', () => {
  const [, first] = ids()

  expect(() => runScript(house(), `update-opening --id ${first} --along 0.7`)).toThrow(
    /already a window/,
  )
})

test('a door cannot be moved to where it could not open', () => {
  const [door] = ids()
  const doc = runScript(
    house(),
    'add-object --room kitchen --type sofa-3 --against south --along 0.5',
  )

  expect(() => runScript(doc, `update-opening --id ${door} --to-side south --along 0.5`)).toThrow(
    /could not open/,
  )
})

test('a change has to say what, and an id that is not there is refused by name', () => {
  const [door] = ids()

  expect(() => runScript(house(), `update-opening --id ${door}`)).toThrow(/say what to change/)
  expect(() => runScript(house(), 'update-opening --id o99 --along 0.5')).toThrow(
    /no door or window called o99/,
  )
})

test('a wider door moved along its wall in one line is checked at its new width', () => {
  const [door] = ids()

  expect(() => runScript(house(), `update-opening --id ${door} --width 2m`)).not.toThrow()
  expect(() => runScript(house(), `update-opening --id ${door} --along -0.6m`)).not.toThrow()
  expect(() => runScript(house(), `update-opening --id ${door} --width 2m --along -0.6m`)).toThrow(
    /runs past the end/,
  )
})

test('an opening put exactly where it is asked for lands there', () => {
  const doc = runScript(house(), 'add-opening --kind door --room kitchen --side south --along 0.25')
  const door = openingsOf(doc, 'door').find((it) => it.side === 'south')!
  expect(door.along).toBeCloseTo(0.25, 1)

  expect(() =>
    runScript(doc, 'add-opening --kind window --room kitchen --side south --width 6m --along 0.9'),
  ).toThrow(/runs past the end/)
})
