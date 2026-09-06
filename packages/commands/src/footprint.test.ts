import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { askPlan } from './answer'
import { runScript } from './run'

const ROOM = 'add-room --shape rectangle --width 6m --depth 5m --material natural-oak --name kuchyň'
const room = () => runScript(createEmptyDocument(), ROOM)
const things = (doc: HouseDocument) => Object.values(doc.objects).map((it) => it.type)

test('something stands in the corner an L-shaped run wraps round', () => {
  const doc = runScript(room(), 'add-object --room kuchyň --type kitchen-l --against north')
  const kitchen = askPlan(doc, 'get-plan --room kuchyň').rooms[0]!.objects[0]!
  expect(kitchen.at).toEqual({ x: 3000, y: 3568 })

  const inside = runScript(
    doc,
    'add-object --room kuchyň --type dining-round-4 --along 0.8 --across 0.6',
  )

  expect(things(inside)).toEqual(['kitchen-l', 'dining-round-4'])
})

test('and is still refused where the run really is', () => {
  const doc = runScript(room(), 'add-object --room kuchyň --type kitchen-l --against north')

  expect(() =>
    runScript(doc, 'add-object --room kuchyň --type dining-round-4 --against north --along 0.7'),
  ).toThrow(/would stand in the l-shaped cabinet set/)
})

test('a U-shaped run keeps its galley, which is the part you stand in', () => {
  const doc = runScript(room(), 'add-object --room kuchyň --type kitchen-u --against north')

  const stool = runScript(
    doc,
    'add-object --room kuchyň --type chair-ottoman --along 0.5 --across 0.62',
  )

  expect(things(stool)).toEqual(['kitchen-u', 'chair-ottoman'])
})

test('a thing that is the rectangle it was cut from keeps every bit of it', () => {
  const doc = runScript(room(), 'add-object --room kuchyň --type dining-6 --along 0.5 --across 0.5')

  expect(() =>
    runScript(doc, 'add-object --room kuchyň --type side-table --along 0.5 --across 0.5'),
  ).toThrow(/would stand in the rectangular dining set/)
})
