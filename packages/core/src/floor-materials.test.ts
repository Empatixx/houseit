import { expect, test } from 'vitest'
import { FLOOR_MATERIAL_IDS, FLOOR_MATERIALS, floorMaterial } from './floor-materials'

test('every material can be found by the id the command surface offers', () => {
  for (const id of FLOOR_MATERIAL_IDS) {
    expect(floorMaterial(id)?.id).toBe(id)
  }
})

test('an unknown material is absent rather than a stand-in', () => {
  expect(floorMaterial('linoleum')).toBeUndefined()
})

test('no two materials share an id', () => {
  expect(new Set(FLOOR_MATERIAL_IDS).size).toBe(FLOOR_MATERIALS.length)
})

test('every material states a real size, so a tile is the same size in any room', () => {
  for (const material of FLOOR_MATERIALS) {
    expect(material.unit.width).toBeGreaterThan(0)
    expect(material.unit.depth).toBeGreaterThan(0)
    expect(material.texture).toMatch(/\.(png|jpg|svg)$/)
    expect(material.colour).toMatch(/^#[0-9a-f]{6}$/)
  }
})

test('a floor pattern repeats inside a room, or it is not a pattern', () => {
  for (const material of FLOOR_MATERIALS) {
    expect(material.unit.width, material.id).toBeLessThanOrEqual(4000)
    expect(material.unit.depth, material.id).toBeLessThanOrEqual(1600)
  }
})
