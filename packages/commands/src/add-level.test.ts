import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { levelsOf } from '@houseit/core/levels'
import { expect, test } from 'vitest'
import { askPlan, runScript } from './run'

const GROUND =
  'add-room --shape rectangle --width 10m --depth 8m --material natural-oak --name obývák'
const house = () => runScript(createEmptyDocument(), GROUND)
const storeys = (doc: HouseDocument) =>
  levelsOf(doc).map((it) => [it.name, it.elevation, it.height])

test('a storey added sits on top of the walls of the one below', () => {
  const doc = runScript(house(), 'add-level --name "1. patro"')

  expect(storeys(doc)).toEqual([
    ['Ground floor', 0, 2800],
    ['1. patro', 2800, 2800],
  ])
})

test('a storey is named in every answer, with which one is open and how it climbs', () => {
  const answer = askPlan(house(), 'add-level --name "1. patro" --height 2.6m')

  expect(answer.levels).toEqual([
    expect.objectContaining({ name: 'Ground floor', storey: 1, rooms: 1, open: true }),
    expect.objectContaining({ name: '1. patro', storey: 2, height: 2600, rooms: 0 }),
  ])
  // 2600 over fifteen risers is 173 mm, which is about as comfortable as a
  // stair gets — and it is the arithmetic a flight out of that storey is drawn to.
  expect(answer.levels[1]!.risers).toBe(15)
})

test('a cellar goes under the house, and the house keeps its own height', () => {
  const doc = runScript(house(), 'add-level --name sklep --height 2.4m --below')

  expect(storeys(doc)).toEqual([
    ['sklep', -2400, 2400],
    ['Ground floor', 0, 2800],
  ])
})

test('two storeys cannot share a name, since that is how a command names one', () => {
  expect(() => runScript(house(), 'add-level --name "Ground floor"')).toThrow(/already a storey/)
})

test('a storey is said to a command by name, not only by id', () => {
  const doc = runScript(
    house(),
    [
      'add-level --name "1. patro"',
      'add-room --shape rectangle --width 10m --depth 8m --material white-oak --name ložnice --level "1. patro"',
    ].join('\n'),
  )

  const upstairs = levelsOf(doc)[1]!
  expect(Object.values(doc.rooms).find((it) => it.name === 'ložnice')?.level).toBe(upstairs.id)
  expect(() => runScript(doc, 'get-plan --level půda')).toThrow(/no storey called půda/)
})

test('a storey made taller lifts everything above it', () => {
  const doc = runScript(
    house(),
    ['add-level --name "1. patro"', 'add-level --name půda', 'update-level --height 3m'].join('\n'),
  )

  expect(storeys(doc)).toEqual([
    ['Ground floor', 0, 3000],
    ['1. patro', 3000, 2800],
    ['půda', 5800, 2800],
  ])
})

test('an empty storey comes out, and the house closes up over the gap', () => {
  const doc = runScript(
    house(),
    ['add-level --name "1. patro"', 'add-level --name půda'].join('\n'),
  )

  const gone = runScript(doc, 'remove-level --level "1. patro"')
  expect(storeys(gone)).toEqual([
    ['Ground floor', 0, 2800],
    ['půda', 2800, 2800],
  ])
})

test('a storey with walls on it is not taken out by accident, nor the last one at all', () => {
  expect(() => runScript(house(), 'remove-level')).toThrow(/at least one storey/)

  const two = runScript(
    house(),
    [
      'add-level --name "1. patro"',
      'add-room --shape rectangle --width 10m --depth 8m --material white-oak --name ložnice --level "1. patro"',
    ].join('\n'),
  )
  expect(() => runScript(two, 'remove-level --level "1. patro"')).toThrow(/wall\(s\) on it/)
})

test('a command that works on another storey answers about that storey', () => {
  const doc = runScript(house(), 'add-level --name "1. patro"')

  // The tab is still on the ground floor; the command is not.
  const answer = askPlan(
    doc,
    'add-room --shape rectangle --width 6m --depth 4m --material white-oak --name ložnice --level "1. patro"',
  )

  expect(answer.rooms.map((it) => it.name)).toEqual(['ložnice'])
  expect(answer.level).toBe(levelsOf(doc)[1]!.id)
  // And the trouble reported is that storey's: a bedroom with no door on it.
  expect(answer.problems.map((it) => it.code)).toContain('house.no-entrance')
})
