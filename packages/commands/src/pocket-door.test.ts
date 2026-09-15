import { readFileSync } from 'node:fs'
import { createEmptyDocument } from '@houseit/core/document'
import { pocketShift } from '@houseit/core/opening-parts'
import { expect, test } from 'vitest'
import { askPlan } from './answer'
import { runScript } from './run'

const source = readFileSync(
  new URL('../../../fixtures/building-proof/pocket-doors.txt', import.meta.url),
  'utf8',
)

test('pocket directions read back and leave the aperture empty after changing direction', () => {
  const doc = runScript(createEmptyDocument(), source)
  const report = askPlan(doc, 'get-plan')
  expect(
    report.rooms
      .flatMap((r) => r.openings)
      .filter((o) => o.id === 'o1')
      .every((o) => o.slideTowards === 'north'),
  ).toBe(true)
  expect(
    report.rooms
      .flatMap((r) => r.openings)
      .filter((o) => o.id === 'o2')
      .every((o) => o.slideTowards === 'south'),
  ).toBe(true)
  const changed = runScript(doc, 'update-opening --id o1 --slide-towards south')
  expect(pocketShift(changed.openings.o1!)).toBe(-pocketShift(doc.openings.o1!))
  const normal = runScript(changed, 'update-opening --id o1 --variant hinged')
  expect(normal.openings.o1!.slide).toBeUndefined()
})

test('pockets cannot point across a wall, exceed its available length, or receive another opening', () => {
  const doc = runScript(createEmptyDocument(), source)
  expect(() => runScript(doc, 'update-opening --id o1 --slide-towards east')).toThrow(
    'must follow the wall',
  )
  expect(() => runScript(doc, 'update-opening --id o1 --width 3000')).toThrow(
    'no uninterrupted wall',
  )
  expect(() =>
    runScript(doc, 'add-opening --room Hall --side east --kind window --width 600 --along 2800'),
  ).toThrow('no uninterrupted wall')
  expect(() => runScript(doc, 'update-opening --id o3 --slide-towards west')).toThrow(
    'needs a pocket door',
  )
})
