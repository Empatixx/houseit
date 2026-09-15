import { expect, test } from 'vitest'
import { roofMeshIssue } from './roof-mesh'

const a = { x: 0, y: 0 },
  b = { x: 4000, y: 0 },
  c = { x: 4000, y: 3000 },
  d = { x: 0, y: 3000 }
test('roof coverage rejects a duplicated half even when its total area is right', () => {
  const outline = [a, b, c, d],
    half = { points: [a, b, c] }
  expect(
    roofMeshIssue(outline, [half, { points: [a, c, d] }], [{ x: 2000, y: 1500 }]),
  ).toBeUndefined()
  expect(roofMeshIssue(outline, [half, half], [])).toBe('roof facets overlap')
  expect(roofMeshIssue(outline, [half], [])).toBe('roof facets must cover the whole outline')
  expect(roofMeshIssue(outline, [half, { points: [a, c, d] }], [{ x: 5000, y: 1500 }])).toBe(
    'roof drain lies outside the roof',
  )
})
