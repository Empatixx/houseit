import { FLOOR_MATERIAL_IDS, floorMaterial } from '@houseit/core/floor-materials'
import { SLAB } from '@houseit/core/levels'
import { planWith } from '@houseit/geometry/test-utils'
import { expect, test } from 'vitest'
import { ceilingPieces, floorPieces } from './floors'

const room = () =>
  planWith([
    [0, 0, 4000, 0],
    [4000, 0, 4000, 3000],
    [4000, 3000, 0, 3000],
    [0, 3000, 0, 0],
  ])

test('a room gets a floor the shape of the room', () => {
  const { doc, level } = room()

  const laid = floorPieces(doc, level)
  expect(laid).toHaveLength(1)
  if (laid[0]?.body.kind !== 'sheet') throw new Error('a floor is a sheet')
  expect(laid[0].body.outline).toHaveLength(4)
  expect(laid[0].body.holes).toEqual([])
})

test('a room with nothing laid in it still has a floor to stand on', () => {
  const { doc, level } = room()

  expect(floorPieces(doc, level)[0]?.paint.texture).toBeUndefined()
  expect(floorPieces(doc, level)[0]?.paint.colour).toMatch(/^#/)
})

test('a floor laid in a material wears its picture, tiled at the size the material really is', () => {
  const { doc, level } = room()
  const id = FLOOR_MATERIAL_IDS[0]!
  const material = floorMaterial(id)!
  doc.rooms.r1 = { id: 'r1', level, x: 2000, y: 1500, name: 'room', floor: id, loop: [] }

  const laid = floorPieces(doc, level)[0]!
  expect(laid.paint.texture).toBe(material.texture)
  expect(laid.paint.repeat).toEqual({
    x: 1000 / material.unit.width,
    y: 1000 / material.unit.depth,
  })
})

test('a storey has a lid, and it sits under the top of its walls', () => {
  const { doc, level } = room()
  const top = doc.levels[level]!.height

  const lid = ceilingPieces(doc, level)[0]!
  if (lid.body.kind !== 'prism') throw new Error('a ceiling is a prism')
  expect(lid.body.thickness).toBe(SLAB)
  expect(lid.at.y).toBeCloseTo(top - SLAB / 2)
})

test('no flat slab stops the sun, because a plan walked through is lit from above', () => {
  const { doc, level } = room()

  expect(ceilingPieces(doc, level)[0]?.casts).toBe(false)
  expect(floorPieces(doc, level)[0]?.casts).toBe(false)
})

test('the slab reaches the outside structural face instead of leaving half the perimeter wall uncovered', () => {
  const { doc, level } = room()
  const lid = ceilingPieces(doc, level)[0]!
  if (lid.body.kind !== 'prism') throw Error('prism expected')
  const half = doc.walls.w1!.thickness / 2
  expect(Math.min(...lid.body.outline.map((p) => p.x))).toBeCloseTo(-half)
  expect(Math.max(...lid.body.outline.map((p) => p.x))).toBeCloseTo(4000 + half)
})
