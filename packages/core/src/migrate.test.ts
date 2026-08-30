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
    roomLabels: { r1: { id: 'r1', level, x: 2000, y: 1500, name: 'kuchyň' } },
    devices: {},
    circuits: {},
  }

  const doc = migrateDocument(v1)

  expect(doc.version).toBe(2)
  expect(doc.rooms.r1).toEqual({ id: 'r1', level, x: 2000, y: 1500, name: 'kuchyň' })
  expect('roomLabels' in doc).toBe(false)
})

test('a room carries no floor until one is set', () => {
  expect(migrateDocument({ ...createEmptyDocument(), version: DOCUMENT_VERSION }).rooms).toEqual({})
})
