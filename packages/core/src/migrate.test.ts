import { expect, test } from 'vitest'
import { createEmptyDocument, DOCUMENT_VERSION } from './document'
import { migrateDocument } from './migrate'

test('passes through a document already at the current version', () => {
  const doc = createEmptyDocument()

  expect(migrateDocument(doc)).toEqual(doc)
})

test('refuses a document written by a newer version of houseit', () => {
  const fromTheFuture = { ...createEmptyDocument(), version: DOCUMENT_VERSION + 1 }

  expect(() => migrateDocument(fromTheFuture)).toThrow(/newer/)
})

test('refuses input that carries no version at all', () => {
  expect(() => migrateDocument({ nodes: {}, walls: {} })).toThrow(/version/)
})

test('reports the failure as a migration problem, not a raw schema error', () => {
  expect(() => migrateDocument('not a document')).toThrow(/version/)
})

test('a v1 document turns its room labels into rooms', () => {
  const level = 'l1'
  const v1 = {
    version: 1,
    levels: { [level]: { id: level, name: 'Ground floor', elevation: 0, height: 2800 } },
    nodes: {},
    walls: {},
    openings: {},
    roomLabels: { r1: { id: 'r1', level, x: 2000, y: 1500, name: 'kuchyň', loop: [] } },
    devices: {},
    circuits: {},
  }

  const doc = migrateDocument(v1)

  expect(doc.version).toBe(DOCUMENT_VERSION)
  expect(doc.rooms.r1).toEqual({ id: 'r1', level, x: 2000, y: 1500, name: 'kuchyň', loop: [] })
  expect('roomLabels' in doc).toBe(false)
})

test("a v2 document's turned things keep their angle under its new name", () => {
  const level = 'l1'
  const v2 = {
    version: 2,
    levels: { [level]: { id: level, name: 'Ground floor', elevation: 0, height: 2800 } },
    nodes: {},
    walls: {},
    openings: {},
    rooms: { r1: { id: 'r1', level, x: 2000, y: 1500, name: 'obývák', loop: [] } },
    objects: {
      f1: {
        id: 'f1',
        level,
        room: 'r1',
        type: 'club-chair',
        along: 0.5,
        width: 850,
        depth: 850,
        surface: 'blue',
        turn: 45,
      },
      f2: {
        id: 'f2',
        level,
        room: 'r1',
        type: 'sofa-3',
        along: 0.2,
        width: 2200,
        depth: 950,
        surface: 'grey',
      },
    },
    devices: {},
    circuits: {},
  }

  const doc = migrateDocument(v2)

  expect(doc.objects.f1).toMatchObject({ rotation: 45 })
  expect('turn' in doc.objects.f1!).toBe(false)
  expect('rotation' in doc.objects.f2!).toBe(false)
})

test('a room carries no floor until one is set', () => {
  expect(migrateDocument({ ...createEmptyDocument(), version: DOCUMENT_VERSION }).rooms).toEqual({})
})

test('a v4 document is upgraded without inventing a parcel site', () => {
  const { site: _site, ...current } = createEmptyDocument()
  const v4 = { ...current, version: 4 }

  const migrated = migrateDocument(v4)

  expect(DOCUMENT_VERSION).toBe(6)
  expect(migrated.version).toBe(DOCUMENT_VERSION)
  expect(migrated.site).toBeUndefined()
})

test('a v3 plan is given the walls round each of its rooms', () => {
  const level = 'l1'
  const at = (id: string, x: number, y: number) => [id, { id, x, y }] as const
  const wall = (id: string, a: string, b: string) =>
    [id, { id, level, a, b, thickness: 150, baseOffset: 0, height: 2600 }] as const

  const v3 = {
    ...createEmptyDocument(),
    version: 3,
    levels: { [level]: { id: level, name: 'Ground floor', storey: 1, elevation: 0, height: 2800 } },
    nodes: Object.fromEntries([
      at('n1', 0, 0),
      at('n2', 6000, 0),
      at('n3', 6000, 4000),
      at('n4', 0, 4000),
      at('n5', 3000, 0),
      at('n6', 3000, 4000),
    ]),
    walls: Object.fromEntries([
      wall('w1', 'n1', 'n5'),
      wall('w2', 'n5', 'n2'),
      wall('w3', 'n2', 'n3'),
      wall('w4', 'n3', 'n6'),
      wall('w5', 'n6', 'n4'),
      wall('w6', 'n4', 'n1'),
      wall('w7', 'n5', 'n6'),
    ]),
    rooms: {
      r1: { id: 'r1', level, x: 1500, y: 2000, name: 'hala', floor: 'ash' },
      r2: { id: 'r2', level, x: 4500, y: 2000, name: 'kuchyň', floor: 'beech' },
    },
  }

  const doc = migrateDocument(v3)

  expect([...doc.rooms.r1!.loop].sort()).toEqual(['w1', 'w5', 'w6', 'w7'])
  expect([...doc.rooms.r2!.loop].sort()).toEqual(['w2', 'w3', 'w4', 'w7'])
  expect(doc.rooms.r1!.name).toBe('hala')
  expect(doc.rooms.r2!.floor).toBe('beech')
})

test('v5 terrain and v5 cadastral projects migrate without losing either payload', () => {
  const terrain = {
    groundCutout: { x0: 0, x1: 10000, y0: 0, y1: 10000 },
    surfaces: [],
    markings: [],
    railings: [],
  }
  const parcel = {
    parcel: {
      id: 'p1',
      nationalReference: '1-1',
      number: '1',
      cadastralAreaCode: '1',
      cadastralAreaName: 'Test',
      areaM2: 400,
      polygons: [
        {
          outer: [
            { x: 0, y: 0 },
            { x: 20000, y: 0 },
            { x: 20000, y: 20000 },
            { x: 0, y: 20000 },
          ],
          holes: [],
        },
      ],
    },
    source: {
      provider: 'cuzk-inspire-cp',
      fetchedAt: '2026-09-15T12:00:00.000Z',
      crs: 'EPSG:5514',
      originXmm: 0,
      originYmm: 0,
      attributionYear: 2026,
    },
    housePlacement: { xMm: 0, yMm: 0, rotationMilliDegrees: 0 },
    setbacks: { defaultMm: 2000, byEdge: {} },
  }
  const base = { ...createEmptyDocument(), version: 5 }
  expect(migrateDocument({ ...base, site: terrain }).site).toEqual(terrain)
  const fromMain = migrateDocument({ ...base, site: parcel })
  expect(fromMain.parcelSite).toEqual(parcel)
  expect(fromMain.site).toBeUndefined()
  const combined = { ...fromMain, site: terrain }
  expect(migrateDocument(combined)).toEqual(combined)
})
