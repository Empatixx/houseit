import { readFileSync } from 'node:fs'
import { createEmptyDocument } from '@houseit/core/document'
import { openingsIn } from '@houseit/core/opening-parts'
import { swingOf } from '@houseit/geometry/swing'
import { expect, test } from 'vitest'
import { askPlan } from './answer'
import { runScript } from './run'

const source = readFileSync(
  new URL('../../../fixtures/building-proof/opening-direction.txt', import.meta.url),
  'utf8',
)
const building = () => runScript(createEmptyDocument(), source)

test('doors and assembly leaves open outside, and keep that destination after moving', () => {
  const doc = building()
  const north = Object.values(doc.openings).find((o) => o.kind === 'assembly')!
  const part = openingsIn(doc).find(
    (o) => o.id.startsWith(`${north.id}-panel`) && o.kind === 'door',
  )!
  expect(swingOf(doc, part)!.y0).toBe(6000)
  const report = askPlan(doc, 'get-plan --room Right').rooms[0]!.openings.find(
    (o) => o.id === north.id,
  )!
  expect(report).toMatchObject({ opensInto: 'outside', hinge: 'left' })
  const moved = runScript(doc, `update-opening --id ${north.id} --to-side east`)
  const leaf = openingsIn(moved).find((o) => o.id === part.id)!
  expect(swingOf(moved, leaf)!.x0).toBe(12000)
  expect(
    askPlan(moved, 'get-plan --room Right').rooms[0]!.openings.find((o) => o.id === north.id),
  ).toMatchObject({ opensInto: 'outside', hinge: 'left' })
  const inside = runScript(doc, `update-opening --id ${north.id} --opens-into Right`)
  expect(swingOf(inside, openingsIn(inside).find((o) => o.id === part.id)!)!.y1).toBe(6000)
  expect(inside.openings[north.id]!.hinge).toBe(north.hinge)
  expect(
    askPlan(inside, 'get-plan --room Right').rooms[0]!.openings.find((o) => o.id === north.id),
  ).toMatchObject({ opensInto: 'Right', hinge: 'right' })
})

test('a destination must lie across the actual wall, and outside means an exterior wall', () => {
  const doc = building()
  expect(
    askPlan(doc, 'get-plan --room Left').rooms[0]!.openings.find((o) => o.id === 'o2'),
  ).toMatchObject({ opensInto: 'Right' })
  expect(() => runScript(doc, 'update-opening --id o2 --opens-into outside')).toThrow(
    'not an exterior boundary',
  )
  expect(() => runScript(doc, 'update-opening --id o1 --opens-into Right')).toThrow(
    'not beside this wall',
  )
  expect(() =>
    runScript(doc, 'add-opening --room Left --kind window --side south --opens-into outside'),
  ).toThrow('needs a hinged door')
})

test('changing an assembly swing checks the actual leaf against furniture', () => {
  const doc = runScript(
    building(),
    'add-object --room Right --type club-chair --along 0.65 --across 0.86',
  )
  expect(() => runScript(doc, 'update-opening --id o3 --opens-into Right')).toThrow(
    'something is standing in its swing',
  )
  expect(doc.openings.o3!.swing).toBe(building().openings.o3!.swing)
})

test('an unglazed assembly door stays a walkable door beside its glazed fanlight', () => {
  const script = readFileSync(
    new URL('../../../fixtures/building-proof/solid-door-fanlight.txt', import.meta.url),
    'utf8',
  )
  const doc = runScript(createEmptyDocument(), script)
  const parts = openingsIn(doc)
  expect(parts.filter((p) => p.kind === 'door')).toHaveLength(2)
  expect(parts.filter((p) => p.kind === 'door').map((p) => p.infill)).toEqual(['opaque', 'glass'])
  expect(parts.filter((p) => p.kind === 'window').every((p) => p.infill === 'glass')).toBe(true)
  expect(() =>
    runScript(createEmptyDocument(), script.replace('"kind":"door"', '"kind":"fixed"')),
  ).toThrow('glazing none belongs to a solid door')
})
