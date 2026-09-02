import { expect, test } from 'vitest'
import { layerOf, OBJECT_TYPE_IDS, OBJECT_TYPES, objectType, symbolOf } from './object-types'
import { SURFACE_IDS, surfaceOf } from './surfaces'

test('every type can be found by the id the command surface offers', () => {
  for (const id of OBJECT_TYPE_IDS) {
    expect(objectType(id)?.id).toBe(id)
  }
})

test('no two types share an id', () => {
  expect(new Set(OBJECT_TYPE_IDS).size).toBe(OBJECT_TYPES.length)
})

test('every type is finished in surfaces that exist', () => {
  for (const entry of OBJECT_TYPES) {
    expect(entry.surfaces.length, entry.id).toBeGreaterThan(0)
    for (const surface of entry.surfaces) {
      expect(SURFACE_IDS).toContain(surface)
    }
  }
})

test('every type has a real size and a symbol to draw it with', () => {
  for (const entry of OBJECT_TYPES) {
    expect(entry.size.width, entry.id).toBeGreaterThan(0)
    expect(entry.size.depth, entry.id).toBeGreaterThan(0)
    expect(entry.symbol, entry.id).toMatch(/^[a-z0-9-]+\.svg$/)
    expect(symbolOf(entry.id)).toBe(entry.symbol)
  }
})

test('every surface has a fill and a darker line to draw it with', () => {
  for (const id of SURFACE_IDS) {
    const surface = surfaceOf(id)!
    expect(surface.fill).toMatch(/^#[0-9a-f]{6}$/)
    expect(surface.line).toMatch(/^#[0-9a-f]{6}$/)
  }
})

test('an unknown type is absent rather than a stand-in', () => {
  expect(objectType('piano')).toBeUndefined()
  expect(symbolOf('piano')).toBeUndefined()
})

test('a rug lies under the furniture and a lamp stands on it; everything else is on the floor', () => {
  expect(layerOf('rug-rect')).toBe('under')
  expect(layerOf('rug-round')).toBe('under')
  expect(layerOf('table-lamp')).toBe('over')
  expect(layerOf('floor-lamp')).toBe('over')
  expect(layerOf('queen-bed')).toBe('floor')
  expect(layerOf('piano')).toBe('floor')
})

test('a bed is seen as its bedding and comes in white unless told otherwise', () => {
  for (const id of ['queen-bed', 'king-bed', 'twin-bed']) {
    expect(objectType(id)?.surfaces[0], id).toBe('white')
    expect(objectType(id)?.stands, id).toBe('wall')
  }
})

test('sanitary ware is white or black and backs onto a wall', () => {
  for (const id of ['toilet-tank', 'vanity-sink', 'bathtub']) {
    expect(objectType(id)?.surfaces, id).toEqual(['white', 'black'])
    expect(objectType(id)?.stands, id).toBe('wall')
  }
})

test('appliances are steel unless told otherwise', () => {
  for (const id of ['refrigerator', 'stove', 'dishwasher']) {
    expect(objectType(id)?.surfaces[0], id).toBe('steel')
  }
})

test('a kitchen is a run: its pieces stand shoulder to shoulder', () => {
  for (const id of ['counter-straight', 'refrigerator', 'stove', 'dishwasher', 'kitchen-sink']) {
    expect(objectType(id)?.abuts, id).toBe(true)
  }
  expect(objectType('sofa-3')?.abuts).toBeUndefined()
})

test('tables and rugs stand free; what has a back stands at a wall', () => {
  expect(objectType('dining-6')?.stands).toBe('free')
  expect(objectType('coffee-table')?.stands).toBe('free')
  expect(objectType('rug-rect')?.stands).toBe('free')
  expect(objectType('sofa-3')?.stands).toBe('wall')
  expect(objectType('media-unit')?.stands).toBe('wall')
  expect(objectType('dresser')?.stands).toBe('wall')
})

test('sizes are the real ones, in millimetres', () => {
  // A queen bed is 60 by 80 inches, give or take the frame round it.
  expect(objectType('queen-bed')?.size).toEqual({ width: 1549, depth: 2057 })
  expect(objectType('sedan')?.size.depth).toBeGreaterThan(4500)
})
