import { createEmptyDocument } from '@houseit/core/document'
import FDBFactory from 'fake-indexeddb/lib/FDBFactory'
import { expect, test } from 'vitest'
import { openProjects } from './db'
import { importLocalPlan, LEGACY_KEY } from './import-local'

const fresh = () => openProjects(new FDBFactory() as unknown as IDBFactory)

/** Enough of the Storage interface to stand in for localStorage, plus a sealed one. */
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
})

test('a plan in localStorage becomes the first project, and the key is let go of', async () => {
  const db = await fresh()
  const store = fake()
  const doc = createEmptyDocument()
  store.setItem(LEGACY_KEY, JSON.stringify(doc))

  await importLocalPlan(db, store)

  const [project] = await db.list()
  expect(project?.name).toBe('My plan')
  expect(await db.read(project?.id ?? '')).toEqual(doc)
  expect(store.getItem(LEGACY_KEY)).toBeNull()
})

test('a plan written by an older build is brought forward on the way in', async () => {
  const db = await fresh()
  const store = fake()
  const level = 'l1'
  store.setItem(
    LEGACY_KEY,
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

  await importLocalPlan(db, store)

  const [project] = await db.list()
  expect((await db.read(project?.id ?? ''))?.rooms.r1?.name).toBe('kuchyň')
})

test('nothing in localStorage means no project is made', async () => {
  const db = await fresh()

  await importLocalPlan(db, fake())

  expect(await db.list()).toEqual([])
})

test('a plan is not brought in twice: with projects already there, it is left alone', async () => {
  const db = await fresh()
  const store = fake()
  store.setItem(LEGACY_KEY, JSON.stringify(createEmptyDocument()))
  await db.put({ id: 'byt', name: 'Byt', createdAt: 1, updatedAt: 1 })

  await importLocalPlan(db, store)

  expect((await db.list()).map((project) => project.id)).toEqual(['byt'])
  expect(store.getItem(LEGACY_KEY)).not.toBeNull()
})

test('junk in localStorage is ignored rather than taking the editor down with it', async () => {
  const db = await fresh()
  const store = fake()
  store.setItem(LEGACY_KEY, 'not json at all')

  await importLocalPlan(db, store)

  expect(await db.list()).toEqual([])
})

test('storage the browser will not let us touch is not an error', async () => {
  const db = await fresh()

  await expect(importLocalPlan(db, sealed())).resolves.toBeUndefined()
  await expect(importLocalPlan(db, undefined)).resolves.toBeUndefined()
})
