import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { wallBetween } from './boundary'

const doc = (): HouseDocument => {
  const plan = createEmptyDocument()
  const level = Object.keys(plan.levels)[0]!
  plan.nodes = { n1: { id: 'n1', x: 0, y: 0 }, n2: { id: 'n2', x: 4000, y: 0 } }
  plan.walls = {
    w1: { id: 'w1', level, a: 'n1', b: 'n2', thickness: 150, height: 2800, baseOffset: 0 },
  } as HouseDocument['walls']
  return plan
}

test('a frozen plan finds a wall from either end through its index, as a live one does', () => {
  const live = doc()
  const level = Object.keys(live.levels)[0]!
  const frozen = structuredClone(live)
  Object.freeze(frozen.walls)
  for (const plan of [live, frozen]) {
    expect(wallBetween(plan, level, 'n1', 'n2')?.id).toBe('w1')
    expect(wallBetween(plan, level, 'n2', 'n1')?.id).toBe('w1')
    expect(wallBetween(plan, 'elsewhere', 'n1', 'n2')).toBeUndefined()
    expect(wallBetween(plan, level, 'n1', 'n3')).toBeUndefined()
  }
})
