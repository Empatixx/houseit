import { createEmptyDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { askPlan, runScript } from './run'

/**
 * A third storey drawn over two that are already there, and cut through the
 * middle. Both halves of that are worth holding onto: storeys stack on the same
 * footprint without their walls tangling, and a cut that takes a slice out of
 * the middle of a room leaves two rooms behind it, not one.
 */
test('a third storey is cut up over two that are already there', () => {
  const doc = runScript(
    createEmptyDocument(),
    [
      'add-room --shape l --width 12m --depth 10m --notch-width 4.5m --notch-depth 4m --material natural-oak --name přízemí',
      'add-level --name "1. patro"',
      'add-room --shape l --width 12m --depth 10m --notch-width 4.5m --notch-depth 4m --material white-oak --name patro --level "1. patro"',
      'add-room --name pokoj --from patro --material white-oak --points "5600,0; 12000,0; 12000,6000; 5600,6000"',
      'add-level --name "2. patro"',
      'add-room --shape rectangle --width 12m --depth 6m --material ash --name podkroví --level "2. patro"',
    ].join('\n'),
  )

  const cut = runScript(
    doc,
    'add-room --name ateliér --from podkroví --material ash --points "3000,0; 8000,0; 8000,6000; 3000,6000"',
  )

  const loft = askPlan(cut, 'get-plan --level "2. patro"').rooms
  // The slice out of the middle, and the two pieces it left either side of it.
  expect(loft.map((it) => it.name).sort()).toEqual(['ateliér', 'podkroví', 'podkroví 2'])
  expect(loft.reduce((total, room) => total + room.areaM2, 0)).toBeCloseTo(12 * 6, 0)
  // And the storeys under it are untouched.
  expect(askPlan(cut, 'get-plan --level "1. patro"').rooms).toHaveLength(2)
  expect(askPlan(cut, 'get-plan --level "Ground floor"').rooms).toHaveLength(1)
})
