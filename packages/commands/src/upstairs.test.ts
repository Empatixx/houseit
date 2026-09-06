import { createEmptyDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { askPlan } from './answer'
import { runScript } from './run'

const SAME_FOOTPRINT = [
  'add-room --shape l --width 12m --depth 10m --notch-width 4m --notch-depth 3m --material natural-oak --name přízemí',
  'add-level --name "1. patro"',
  'add-room --shape l --width 12m --depth 10m --notch-width 4m --notch-depth 3m --material white-oak --name patro --level "1. patro"',
].join('\n')

test('a storey is cut up over a storey of the very same shape', () => {
  const doc = runScript(
    createEmptyDocument(),
    [
      SAME_FOOTPRINT,
      'add-room --name ložnice --from patro --material white-oak --points "6000,0; 12000,0; 12000,7000; 6000,7000"',
      'add-room --name koupelna --from přízemí --material tile-white --points "6000,0; 12000,0; 12000,7000; 6000,7000"',
    ].join('\n'),
  )

  expect(
    askPlan(doc, 'get-plan --level "1. patro"')
      .rooms.map((it) => it.name)
      .sort(),
  ).toEqual(['ložnice', 'patro'])
  expect(
    askPlan(doc, 'get-plan --level "Ground floor"')
      .rooms.map((it) => it.name)
      .sort(),
  ).toEqual(['koupelna', 'přízemí'])
})

test('the storeys keep their own corners, so neither hangs off the other', () => {
  const doc = runScript(createEmptyDocument(), SAME_FOOTPRINT)
  const levels = Object.keys(doc.levels)

  const nodesOf = (level: string) =>
    new Set(
      Object.values(doc.walls)
        .filter((wall) => wall.level === level)
        .flatMap((wall) => [wall.a, wall.b]),
    )
  const [ground, upper] = levels.map(nodesOf)
  expect([...ground!].filter((node) => upper!.has(node))).toEqual([])
})

test('a storey is drawn on and then cut up, all in one script', () => {
  const doc = runScript(
    createEmptyDocument(),
    [
      'add-room --shape rectangle --width 12m --depth 10m --material natural-oak --name přízemí',
      'add-level --name "1. patro"',
      'add-room --shape rectangle --width 12m --depth 10m --material white-oak --name patro --level "1. patro"',
      'add-room --name pokoj --from patro --material white-oak --points "0,0; 5600,0; 5600,2200; 0,2200"',
    ].join('\n'),
  )

  const upstairs = askPlan(doc, 'get-plan --level "1. patro"')
  expect(upstairs.rooms.map((it) => it.name).sort()).toEqual(['patro', 'pokoj'])
})
