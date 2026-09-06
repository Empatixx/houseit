import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { askPlan, runScript } from './run'

/**
 * The corner an L-shaped kitchen wraps round is floor, and something may stand
 * in it. Its box says otherwise, which is why a thing is checked against the
 * boxes it really fills instead.
 */
const ROOM = 'add-room --shape rectangle --width 6m --depth 5m --material natural-oak --name kuchyň'
const room = () => runScript(createEmptyDocument(), ROOM)
const things = (doc: HouseDocument) => Object.values(doc.objects).map((it) => it.type)

test('something stands in the corner an L-shaped run wraps round', () => {
  // Against the north wall, the run goes along it and its leg comes down the
  // west side, as the drawing has it. What that leaves is the corner it wraps
  // round, to the east of the leg and in front of the run — and a table
  // stands in it.
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

  // Against the same wall, along the run itself: that is the worktop, not floor.
  expect(() =>
    runScript(doc, 'add-object --room kuchyň --type dining-round-4 --against north --along 0.7'),
  ).toThrow(/would stand in the l-shaped cabinet set/)
})

test('a U-shaped run keeps its galley, which is the part you stand in', () => {
  const doc = runScript(room(), 'add-object --room kuchyň --type kitchen-u --against north')

  // Down the middle of a U is the galley, and it is floor: a stool stands there
  // even though the box round the whole run says it is a worktop.
  const stool = runScript(
    doc,
    'add-object --room kuchyň --type chair-ottoman --along 0.5 --across 0.62',
  )

  expect(things(stool)).toEqual(['kitchen-u', 'chair-ottoman'])
})

test('a thing that is the rectangle it was cut from keeps every bit of it', () => {
  const doc = runScript(room(), 'add-object --room kuchyň --type dining-6 --along 0.5 --across 0.5')

  // A table has no empty corner to offer, so the middle of it is still the table.
  expect(() =>
    runScript(doc, 'add-object --room kuchyň --type side-table --along 0.5 --across 0.5'),
  ).toThrow(/would stand in the rectangular dining set/)
})
