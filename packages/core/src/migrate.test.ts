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
