import { createEmptyDocument } from '@houseit/core/document'
import { roofMeshIssue } from '@houseit/core/roof-mesh'
import { expect, test } from 'vitest'
import { runScript } from './run'

const roofsOf = (script: string) => {
  const doc = runScript(createEmptyDocument(), script)
  return Object.values(doc.levels)[0]!.roofs ?? []
}

test('a rectangular house takes one gable roof over its walls', () => {
  const [roof, ...rest] = roofsOf(
    'add-room --name dům --shape rectangle --width 11m --depth 8m --material natural-oak\nadd-roof --shape gable --covering slate',
  )
  expect(rest).toEqual([])
  expect(roof).toMatchObject({
    material: 'slate',
    pitched: { shape: 'gable', axis: 'x', pitch: 35 },
  })
  expect(roof!.outline).toEqual([
    { x: -150, y: -150 },
    { x: 11150, y: -150 },
    { x: 11150, y: 8150 },
    { x: -150, y: 8150 },
  ])
  expect(roofMeshIssue(roof!.outline, roof!.facets!, [])).toBeUndefined()
})

test('an L house gets a wing roof whose ridge runs into the main one', () => {
  const roofs = roofsOf(
    'add-room --name dům --shape l --width 14m --depth 11m --notch-width 6m --notch-depth 5m --material natural-oak\nadd-roof --shape hip',
  )
  expect(roofs).toHaveLength(2)
  const wing = roofs[1]!
  expect(wing.pitched?.ends).toContain('gable')
  expect(Object.values(wing.pitched!.overhang)).toContain(0)
  for (const roof of roofs) expect(roofMeshIssue(roof.outline, roof.facets!, [])).toBeUndefined()
})

test('a flat roof is a membrane behind a parapet, and remove-roof takes it off', () => {
  const script =
    'add-room --name dům --shape rectangle --width 9m --depth 7m --material natural-oak\nadd-roof --shape flat'
  const [roof] = roofsOf(script)
  expect(roof).toMatchObject({ finish: 'membrane', parapet: { height: 300 } })
  expect(roofsOf(`${script}\nremove-roof`)).toEqual([])
})
