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
