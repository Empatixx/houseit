import { expect, test } from 'vitest'
import { heightOf } from './heights'
import { IMPORTED_TYPES, importedType, modelFileOf } from './imported'
import { CATALOG_OBJECT_TYPES } from './catalog'
import { layerOf, OBJECT_TYPE_IDS, OBJECT_TYPES, objectType, symbolOf } from './object-types'
import { isStaircase, STAIR_KINDS, stairKind } from './stairs'
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

const catalogued = (id: string) => CATALOG_OBJECT_TYPES.some((type) => type.id === id)

test('every type has a real size, and a symbol unless it is drawn instead', () => {
  for (const entry of OBJECT_TYPES) {
    expect(entry.size.width, entry.id).toBeGreaterThan(0)
    expect(entry.size.depth, entry.id).toBeGreaterThan(0)
    if (
      isStaircase(entry.id) ||
      (importedType(entry.id) && !catalogued(entry.id) && !importedType(entry.id)?.symbol)
    ) {
      expect(symbolOf(entry.id), entry.id).toBeUndefined()
      continue
    }
    expect(entry.symbol, entry.id).toMatch(/^[a-z0-9-]+\.svg$/)
    expect(symbolOf(entry.id)).toBe(entry.symbol)
  }
})

test('a type that only borrows a model keeps the symbol the plan draws it with', () => {
  const borrowed = IMPORTED_TYPES.filter((type) => catalogued(type.id))

  expect(borrowed.length).toBeGreaterThan(0)
  for (const type of borrowed) expect(symbolOf(type.id), type.id).toMatch(/\.svg$/)
})

test('every kind of staircase is in the catalogue, and every staircase is a kind', () => {
  const stairs = OBJECT_TYPES.filter((entry) => isStaircase(entry.id))

  expect(stairs.map((entry) => stairKind(entry.id)).sort()).toEqual([...STAIR_KINDS].sort())
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
  expect(objectType('queen-bed')?.size).toEqual({ width: 1549, depth: 2057 })
  expect(objectType('sedan')?.size.depth).toBeGreaterThan(4500)
})

test('a type brought in as a model is a type like any other, and says where its model is', () => {
  for (const brought of IMPORTED_TYPES) {
    const entry = OBJECT_TYPES.find((candidate) => candidate.id === brought.id)

    expect(entry, brought.id).toBeDefined()
    expect(entry!.size).toEqual({ width: brought.size.width, depth: brought.size.depth })
    expect(brought.size.height).toBeGreaterThan(0)
    expect(brought.model).toMatch(/^[a-z0-9-]+\.glb$/)
    expect(heightOf(brought.id).height).toBe(brought.size.height)
  }
})

test('a brought model for a type the catalogue already has does not make a second type', () => {
  const twice = OBJECT_TYPE_IDS.filter((id, nth) => OBJECT_TYPE_IDS.indexOf(id) !== nth)

  expect(twice).toEqual([])
})

test('a brought model still answers for a type the catalogue already has', () => {
  for (const brought of IMPORTED_TYPES) {
    expect(modelFileOf(brought.id)).toBe(brought.model)
    expect(objectType(brought.id)).toBeDefined()
  }
})

test('a brought model is declared at the size the catalogue places it at, so it is not stretched twice', () => {
  for (const brought of IMPORTED_TYPES) {
    const type = objectType(brought.id)!
    expect([brought.id, type.size.width, type.size.depth]).toEqual([
      brought.id,
      brought.size.width,
      brought.size.depth,
    ])
  }
})

test('Blender furniture uses detailed plan symbols independently of its 3D model', () => {
  for (const id of ['bed-upholstered', 'bed-channelled']) {
    expect(symbolOf(id)).toBe(symbolOf('queen-bed'))
    expect(modelFileOf(id)).toBe(`${id}.glb`)
  }
  for (const id of [
    'dining-chair',
    'table-rectangular',
    'table-round',
    'television-flat',
    'tv-stand-wood',
  ]) {
    expect(symbolOf(id), id).toMatch(/\.svg$/)
    expect(modelFileOf(id), id).toMatch(/\.glb$/)
  }
})

test('the bedroom refresh preserves existing catalogue footprints and plan symbols', () => {
  for (const id of ['nightstand', 'dresser', 'twin-bed', 'crib']) {
    const original = CATALOG_OBJECT_TYPES.find((type) => type.id === id)!
    expect(objectType(id)?.size, id).toEqual(original.size)
    expect(symbolOf(id), id).toBe(original.symbol)
    expect(modelFileOf(id), id).toMatch(/\.glb$/)
  }
  expect(modelFileOf('wardrobe')).toBe('wardrobe-classic.glb')
  expect(heightOf('twin-bed').height).toBe(1050)
})
