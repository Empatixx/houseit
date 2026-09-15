import { expect, test } from 'vitest'
import { connectionHoles } from './connections'
import { planWith } from './test-utils'

test('a shaft pierces intermediate slabs and the arrival floor, then stops below the last ceiling', () => {
  const { doc, level } = planWith([])
  doc.levels.up = { id: 'up', name: 'Up', elevation: 3000, height: 3000 }
  doc.levels[level]!.shafts = [
    { id: 'shaft', kind: 'lift', x: 1000, y: 1000, width: 2000, depth: 2000, to: 'up' },
  ]
  expect(connectionHoles(doc, level)).toHaveLength(0)
  expect(connectionHoles(doc, level, true)).toHaveLength(1)
  expect(connectionHoles(doc, 'up')).toHaveLength(1)
  expect(connectionHoles(doc, 'up', true)).toHaveLength(0)
})
