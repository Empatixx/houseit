import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { produce } from 'immer'
import { expect, test } from 'vitest'
import { runScript } from './run'

const PLAN = [
  'add-room --material natural-oak --shape rectangle --width 8m --depth 6m --name flat',
  'add-room --material tile-white --from flat --side west --width 3m --name bath',
].join('\n')

const built = () => runScript(createEmptyDocument(), PLAN)

const tooHigh = (doc: HouseDocument) =>
  produce(doc, (draft) => {
    const wall = Object.values(draft.walls).find((it) => it.level && it.thickness === 300)!
    draft.openings.o99 = {
      id: 'o99',
      wall: wall.id,
      t: 0.5,
      kind: 'window',
      variant: 'hinged',
      width: 900,
      height: 1500,
      sillHeight: 1200,
      hinge: 'a',
      swing: 1,
    } as HouseDocument['openings'][string]
  })

test('a window that would reach above the soffit is refused when it is put in', () => {
  expect(() =>
    runScript(
      built(),
      'add-opening --kind window --room bath --side north --width 0.9m --sill 1.2m',
    ),
  ).toThrow(/2700 mm.*2550 mm/)
  expect(() =>
    runScript(
      built(),
      'add-opening --kind window --room bath --side north --width 0.9m --sill 1.2m --height 1m',
    ),
  ).not.toThrow()
})

test('a fault already in the plan does not stop an unrelated wall from moving', () => {
  const doc = tooHigh(built())
  const moved = runScript(doc, 'update-room --room bath --side east --by 400')
  expect(moved.nodes).not.toEqual(doc.nodes)
})

test('a move that makes a new fault is still refused', () => {
  const doc = runScript(
    built(),
    'add-opening --kind window --room bath --side north --width 2.4m --sill 0.9m --height 1.2m',
  )
  expect(() => runScript(doc, 'update-room --room bath --side east --by -800')).toThrow(
    /no longer fits/,
  )
})
