import { expect, test } from 'vitest'
import { roofMeshIssue } from './roof-mesh'
import { outlineOf, pitchedFacets, rectanglesOf } from './roof-shapes'

const RECT = { x0: 0, y0: 0, x1: 11000, y1: 8000 }

test('every pitched shape covers its rectangle exactly', () => {
  for (const shape of ['gable', 'hip', 'shed'] as const)
    for (const axis of ['x', 'y'] as const) {
      const facets = pitchedFacets(RECT, { shape, pitch: 35, axis, eave: 40 })
      expect(roofMeshIssue(outlineOf(RECT), facets, []), `${shape} ${axis}`).toBeUndefined()
    }
})

test('a gable rises to its ridge in the middle, at the pitch', () => {
  const facets = pitchedFacets(RECT, { shape: 'gable', pitch: 45, axis: 'x', eave: 40 })
  const top = Math.max(...facets.flatMap((facet) => facet.points.map((p) => p.height)))
  expect(top).toBe(40 + 4000)
  const ridge = facets.flatMap((f) => f.points).filter((p) => p.height === top)
  expect(new Set(ridge.map((p) => p.y))).toEqual(new Set([4000]))
})

test('a hip on a square comes to a point', () => {
  const square = { x0: 0, y0: 0, x1: 8000, y1: 8000 }
  const facets = pitchedFacets(square, { shape: 'hip', pitch: 30, axis: 'x', eave: 40 })
  expect(roofMeshIssue(outlineOf(square), facets, [])).toBeUndefined()
  const peaks = facets.flatMap((f) => f.points).filter((p) => p.height > 40)
  expect(new Set(peaks.map((p) => `${p.x},${p.y}`))).toEqual(new Set(['4000,4000']))
})

test('an L splits into the largest rectangle and its wing', () => {
  const ell = [
    { x: 0, y: 0 },
    { x: 14000, y: 0 },
    { x: 14000, y: 6000 },
    { x: 8000, y: 6000 },
    { x: 8000, y: 11000 },
    { x: 0, y: 11000 },
  ]
  const rects = rectanglesOf(ell)
  expect(rects).toHaveLength(2)
  const area = (r: (typeof rects)[number]) => (r.x1 - r.x0) * (r.y1 - r.y0)
  expect(rects.reduce((sum, r) => sum + area(r), 0)).toBe(14000 * 6000 + 8000 * 5000)
  expect(area(rects[0]!)).toBeGreaterThanOrEqual(area(rects[1]!))
})
