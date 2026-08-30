import { createEmptyDocument, DOCUMENT_VERSION } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { loadDocument, STORAGE_KEY, saveDocument } from './persistence'

/** Enough of the Storage interface to stand in for localStorage, plus a throwing one. */
const fake = (): Storage => {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value),
  }
}

const sealed = (): Storage => ({
  ...fake(),
  getItem: () => {
    throw new Error('access denied')
  },
  setItem: () => {
    throw new Error('access denied')
  },
})

test('a saved document comes back', () => {
  const store = fake()
  const doc = createEmptyDocument()

  saveDocument(doc, store)

  expect(loadDocument(store)).toEqual(doc)
})

test('nothing saved yet means nothing to load', () => {
  expect(loadDocument(fake())).toBeUndefined()
})

test('a document written by an older version is brought forward', () => {
  const store = fake()
  const level = 'l1'
  store.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 1,
      levels: { [level]: { id: level, name: 'Ground floor', elevation: 0, height: 2800 } },
      nodes: {},
      walls: {},
      openings: {},
      roomLabels: { r1: { id: 'r1', level, x: 1, y: 1, name: 'kuchyň' } },
      devices: {},
      circuits: {},
    }),
  )

  const doc = loadDocument(store)

  expect(doc?.version).toBe(DOCUMENT_VERSION)
  expect(doc?.rooms.r1?.name).toBe('kuchyň')
})

test('junk in storage is ignored rather than taking the editor down with it', () => {
  const store = fake()
  store.setItem(STORAGE_KEY, 'not json at all')

  expect(loadDocument(store)).toBeUndefined()
})

test('a document from a newer build is ignored, not half-read', () => {
  const store = fake()
  store.setItem(STORAGE_KEY, JSON.stringify({ ...createEmptyDocument(), version: 99 }))

  expect(loadDocument(store)).toBeUndefined()
})

test('storage the browser will not let us touch is not an error', () => {
  expect(loadDocument(sealed())).toBeUndefined()
  expect(() => saveDocument(createEmptyDocument(), sealed())).not.toThrow()
})
