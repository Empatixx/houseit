import { RoofSchema } from '@houseit/core/roof'
import { planWith } from '@houseit/geometry/test-utils'
import { expect, test } from 'vitest'
import { ceilingPieces } from './floors'
import { roofPieces } from './roofs'

test('a roof starts on the structural slab, carries its measured falls and puts a drain on the surface', () => {
  const { doc, level } = planWith([
    [0, 0, 4000, 0],
    [4000, 0, 4000, 3000],
    [4000, 3000, 0, 3000],
    [0, 3000, 0, 0],
  ])
  doc.levels[level]!.height = 3300
  doc.levels[level]!.clearHeight = 2900
  doc.levels[level]!.slabThickness = 250
  const roof = RoofSchema.parse({
    name: 'Roof',
    outline: [
      { x: -100, y: -100 },
      { x: 4100, y: -100 },
      { x: 4100, y: 3100 },
      { x: -100, y: 3100 },
    ],
    finish: 'planted',
    depth: 318,
    baseOffset: -150,
    parapet: { height: 600, thickness: 300, colour: '#ffffff' },
    fall: { percent: 3, towards: 'south' },
    drains: [{ x: 2000, y: 0, diameter: 150 }],
  })
  doc.levels[level]!.roofs = [roof]
  const pieces = roofPieces(doc, level),
    surface = pieces[0]!
  expect(surface.at.y).toBe(3150 + 159)
  expect(surface.body.kind === 'prism' && surface.body.slope?.z).toBe(-0.03)
  const drain = pieces.find((p) => p.body.kind === 'drum')!
  expect(drain.at.y - 5).toBeCloseTo(3150 + 318 + 3)
  const lids = ceilingPieces(doc, level)
  expect(lids.some((p) => p.name?.includes('buildup'))).toBe(false)
  expect(lids.every((p) => p.body.kind === 'prism' && p.body.thickness === 250)).toBe(true)
})
