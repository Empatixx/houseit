import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { askPlan, runScript } from './run'

/**
 * A room is where something stands, not a label it was given once. Carried past
 * a wall, a thing belongs to the room it landed in — and is told so out loud,
 * because a thing that changes rooms quietly is a thing you go looking for.
 *
 * The living room here is an L with the bedroom cut out of its north-east
 * corner, so a place said in the living room's own words can fall inside the
 * bedroom: the fractions are of the box round a room, and an L does not fill
 * its box.
 */
const HOUSE = [
  'add-room --shape rectangle --width 10m --depth 6m --material natural-oak --name obývák',
  'add-room --name ložnice --from obývák --corner north-east --width 4m --depth 3m --material white-oak',
  'add-opening --room ložnice --kind door --side south',
  'add-opening --room obývák --kind door --side south',
  'add-object --room obývák --type dresser --against west --along 0.5',
].join('\n')

const house = () => runScript(createEmptyDocument(), HOUSE)
const dresser = (doc: HouseDocument) => Object.values(doc.objects)[0]!
const roomOf = (doc: HouseDocument, id: string) =>
  askPlan(doc, 'get-plan').rooms.find((room) => room.objects.some((it) => it.id === id))?.name

test('a thing carried past the wall lands in the room next door', () => {
  const doc = house()
  const id = dresser(doc).id
  expect(roomOf(doc, id)).toBe('obývák')

  // The north-east of the living room's box is the bedroom, not the living room.
  const moved = runScript(doc, `update-object --id ${id} --along 0.85 --across 0.8`)

  expect(roomOf(moved, id)).toBe('ložnice')
  // And it comes off the wall it was against: carried across a room, it stands free.
  expect(moved.objects[id]!.against).toBeUndefined()
})

test('and the answer says so, since nobody asked for it to change rooms', () => {
  const doc = house()
  const id = dresser(doc).id

  const answer = askPlan(doc, `update-object --id ${id} --along 0.85 --across 0.8`)

  expect(answer.notes).toEqual(['the dresser went from obývák into ložnice'])
  // Both rooms are in the answer: the one it left and the one it arrived in.
  expect(answer.rooms.map((room) => room.name).sort()).toEqual(['ložnice', 'obývák'])
})

test('something new that hangs out of the room it was asked for is still refused', () => {
  // Reaching over the edge is allowed on the way somewhere; it is not a place
  // to put something down. Hard into the south-west corner, a chest overhangs
  // the room, and that is the whole use of the check.
  expect(() =>
    runScript(house(), 'add-object --room obývák --type dresser --along 0.02 --across 0.02'),
  ).toThrow(/does not fit in obývák/)
})

test('what it may never do is stand in a wall, carried or not', () => {
  const doc = house()
  const id = dresser(doc).id

  // Into the partition between the two rooms rather than through it.
  expect(() => runScript(doc, `update-object --id ${id} --along 0.6 --across 0.52`)).toThrow(
    /stand in a wall/,
  )
})

test('a move inside its own room says nothing, because nothing surprising happened', () => {
  const doc = house()
  const id = dresser(doc).id

  expect(askPlan(doc, `update-object --id ${id} --along 0.3 --across 0.3`).notes).toBeUndefined()
})
