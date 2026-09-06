import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { askPlan, runScript } from './run'

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

  const moved = runScript(doc, `update-object --id ${id} --along 0.85 --across 0.8`)

  expect(roomOf(moved, id)).toBe('ložnice')
  expect(moved.objects[id]!.against).toBeUndefined()
})

test('and the answer says so, since nobody asked for it to change rooms', () => {
  const doc = house()
  const id = dresser(doc).id

  const answer = askPlan(doc, `update-object --id ${id} --along 0.85 --across 0.8`)

  expect(answer.notes).toEqual(['the dresser went from obývák into ložnice'])
  expect(answer.rooms.map((room) => room.name).sort()).toEqual(['ložnice', 'obývák'])
})

test('something new that hangs out of the room it was asked for is still refused', () => {
  expect(() =>
    runScript(house(), 'add-object --room obývák --type dresser --along 0.02 --across 0.02'),
  ).toThrow(/does not fit in obývák/)
})

test('what it may never do is stand in a wall, carried or not', () => {
  const doc = house()
  const id = dresser(doc).id

  expect(() => runScript(doc, `update-object --id ${id} --along 0.6 --across 0.52`)).toThrow(
    /stand in a wall/,
  )
})

test('a move inside its own room says nothing, because nothing surprising happened', () => {
  const doc = house()
  const id = dresser(doc).id

  expect(askPlan(doc, `update-object --id ${id} --along 0.3 --across 0.3`).notes).toBeUndefined()
})
