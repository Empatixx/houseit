import { expect, test } from 'vitest'
import { partsOf } from './footprint'
import { SYMBOL_FOOTPRINTS } from './footprints'
import { IMPORTED_TYPES } from './imported'
import { OBJECT_TYPE_IDS } from './object-types'

test('a type nobody shaped fills the box it was cut from', () => {
  expect(partsOf('queen-bed')).toEqual([{ x0: 0, y0: 0, x1: 1, y1: 1 }])
})

test('a shaped type leaves the floor its box lies about', () => {
  const parts = partsOf('kitchen-l')

  expect(parts.length).toBeGreaterThan(1)
  expect(parts.some((part) => part.x1 < 1 || part.y1 < 1)).toBe(true)
})

test('the shapes read off the symbols are the ones whose box lies', () => {
  for (const id of ['kitchen-l', 'kitchen-u', 'sofa-l', 'office-desk-l', 'counter-l']) {
    expect(partsOf(id).length, id).toBeGreaterThan(1)
  }
  for (const id of ['queen-bed', 'bathtub', 'stairs-u', 'stairs-spiral', 'dining-6']) {
    expect(partsOf(id), id).toEqual([{ x0: 0, y0: 0, x1: 1, y1: 1 }])
  }
})

test('every shape read off a symbol is a real type, inside its own square', () => {
  for (const [id, parts] of Object.entries(SYMBOL_FOOTPRINTS)) {
    expect(OBJECT_TYPE_IDS, id).toContain(id)
    expect(parts.length, id).toBeGreaterThan(1)
    for (const part of parts) {
      expect(part.x0, id).toBeGreaterThanOrEqual(0)
      expect(part.y0, id).toBeGreaterThanOrEqual(0)
      expect(part.x1, id).toBeLessThanOrEqual(1)
      expect(part.y1, id).toBeLessThanOrEqual(1)
      expect(part.x1, id).toBeGreaterThan(part.x0)
      expect(part.y1, id).toBeGreaterThan(part.y0)
    }
  }
})

test('a shape leaves floor free, or it would not be worth saying', () => {
  for (const [id, parts] of Object.entries(SYMBOL_FOOTPRINTS)) {
    const covered = parts.reduce((sum, part) => sum + (part.x1 - part.x0) * (part.y1 - part.y0), 0)
    expect(covered, id).toBeLessThan(0.8)
  }
})

test('a type brought in as a model may say what it really fills', () => {
  for (const type of IMPORTED_TYPES.filter((entry) => entry.parts !== undefined)) {
    expect(partsOf(type.id)).toEqual(type.parts)
  }
})

test('a brought type that says nothing fills its box, like everything else', () => {
  for (const type of IMPORTED_TYPES.filter((entry) => entry.parts === undefined)) {
    expect(partsOf(type.id)).toEqual([{ x0: 0, y0: 0, x1: 1, y1: 1 }])
  }
})
