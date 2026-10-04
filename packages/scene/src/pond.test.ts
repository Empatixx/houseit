import { excavations } from '@houseit/geometry/excavation'
import { planWith } from '@houseit/geometry/test-utils'
import { expect, test } from 'vitest'
import { floorPieces } from './floors'

const pond = () => {
  const { doc, level } = planWith([
    [0, 0, 4000, 0],
    [4000, 0, 4000, 3000],
    [4000, 3000, 0, 3000],
    [0, 3000, 0, 0],
  ])
  doc.rooms.r1 = { id: 'r1', level, x: 2000, y: 1500, name: 'Rybník', kind: 'pond', loop: [] }
  return { doc, level }
}

test('a pond is water below the ground over a bed, ringed with stones', () => {
  const { doc, level } = pond()
  const pieces = floorPieces(doc, level)
  const water = pieces.find((p) => p.name?.startsWith('pond-water'))!
  const bed = pieces.find((p) => p.name?.startsWith('pond-bed'))!
  expect(water.at.y).toBeLessThan(0)
  expect(water.paint.opacity).toBeLessThan(1)
  expect(bed.at.y).toBeLessThan(water.at.y)
  expect(pieces.filter((p) => p.name?.startsWith('pond-stone')).length).toBeGreaterThan(20)
  expect(pieces.filter((p) => p.name?.startsWith('pond-liner'))).toHaveLength(4)
  expect(pieces.some((p) => p.name?.startsWith('floor-'))).toBe(false)
})

test('the ground is cut away where the pond is', () => {
  const { doc } = pond()
  const holes = excavations(doc)
  expect(holes.length).toBeGreaterThan(0)
  const xs = holes.flat().map((p) => p.x)
  expect(Math.min(...xs)).toBeLessThanOrEqual(0)
  expect(Math.max(...xs)).toBeGreaterThanOrEqual(4000)
})
