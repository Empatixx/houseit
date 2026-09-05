import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { levelsOf } from '@houseit/core/levels'
import { roomsOf } from '@houseit/geometry/rooms'
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

test('the last room on a storey is cleared away, so the storey can be built again', () => {
  const doc = runScript(
    house(),
    [
      'add-level --name "1. patro"',
      'add-room --shape rectangle --width 10m --depth 8m --material white-oak --name ložnice --level "1. patro"',
      'add-object --room ložnice --type queen-bed --against north',
    ].join('\n'),
  )

  const bare = runScript(doc, 'remove-room --room ložnice')

  expect(roomsOf(bare, levelsOf(bare)[1]!.id)).toEqual([])
  expect(Object.values(bare.walls).filter((wall) => wall.level === levelsOf(bare)[1]!.id)).toEqual(
    [],
  )
  expect(Object.values(bare.objects)).toEqual([])
  // The ground floor is untouched, and the storey is there to draw on again.
  expect(roomsOf(bare, levelsOf(bare)[0]!.id)).toHaveLength(1)
  expect(() =>
    runScript(
      bare,
      'add-room --shape l --width 10m --depth 8m --notch-width 3m --notch-depth 3m --material white-oak --name podkroví --level "1. patro"',
    ),
  ).not.toThrow()
})

test('a room with neighbours still has to say where it is knocked through to', () => {
  const doc = runScript(
    house(),
    'add-room --name kout --from obývák --side west --width 2m --material white-oak',
  )

  expect(() => runScript(doc, 'remove-room --room kout')).toThrow(/say which room kout is knocked/)
})

test('a storey moved down the stack takes its rooms with it', () => {
  const doc = runScript(
    house(),
    [
      'add-level --name "1. patro"',
      'add-room --shape rectangle --width 10m --depth 8m --material white-oak --name ložnice --level "1. patro"',
    ].join('\n'),
  )
  const upper = levelsOf(doc)[1]!.id

  const swapped = runScript(doc, 'update-level --level "1. patro" --storey 1')

  // The bedroom is now the ground floor, and the living room is over it.
  expect(storeys(swapped)).toEqual([
    ['1. patro', 0, 2800],
    ['Ground floor', 2800, 2800],
  ])
  expect(levelsOf(swapped)[0]!.id).toBe(upper)
  expect(roomsOf(swapped, upper).map((it) => it.name)).toEqual(['ložnice'])
})

test('there is no storey past the top of the house to move one to', () => {
  const doc = runScript(house(), 'add-level --name "1. patro"')

  expect(() => runScript(doc, 'update-level --storey 5')).toThrow(/2 storey\(s\)/)
})

test('with no storey said, a command means the one being looked at', () => {
  const doc = runScript(
    house(),
    [
      'add-level --name "1. patro"',
      'add-room --shape rectangle --width 6m --depth 4m --material white-oak --name ložnice --level "1. patro"',
    ].join('\n'),
  )
  const [ground, upper] = levelsOf(doc)

  // Standing on the ground floor, `get-plan` is about the ground floor.
  expect(askPlan(doc, 'get-plan', ground!.id).rooms.map((it) => it.name)).toEqual(['obývák'])
  // Standing upstairs, the very same words are about upstairs.
  expect(askPlan(doc, 'get-plan', upper!.id).rooms.map((it) => it.name)).toEqual(['ložnice'])
})

test('every answer says which storey it is about and which one is open', () => {
  const doc = runScript(house(), 'add-level --name "1. patro"')
  const [ground, upper] = levelsOf(doc)

  const here = askPlan(doc, 'get-plan', ground!.id)
  expect(here.level).toBe(ground!.id)
  expect(here.levels.find((it) => it.open)?.name).toBe('Ground floor')

  // A storey named takes the answer with it, even one nobody has drawn on.
  const there = askPlan(doc, 'get-plan --level "1. patro"', ground!.id)
  expect(there.level).toBe(upper!.id)
  expect(there.rooms).toEqual([])
})

test('a bare storey drawn on is the one being looked at, not the lowest', () => {
  const doc = runScript(house(), 'add-level --name "1. patro"')
  const upper = levelsOf(doc)[1]!

  const built = runScript(
    doc,
    'add-room --shape rectangle --width 6m --depth 4m --material white-oak --name podkroví',
    upper.id,
  )

  expect(roomsOf(built, upper.id).map((it) => it.name)).toEqual(['podkroví'])
  expect(roomsOf(built, levelsOf(built)[0]!.id).map((it) => it.name)).toEqual(['obývák'])
})
