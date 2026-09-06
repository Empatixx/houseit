import { createEmptyDocument, DOCUMENT_VERSION } from '@houseit/core/document'
import { IDBFactory as FakeIndexedDb } from 'fake-indexeddb'
import { expect, test } from 'vitest'
import { openProjects, type ProjectMeta, type ProjectsDb } from './db'

const fresh = () => openProjects(new FakeIndexedDb())

const meta = (id: string, updatedAt = 1): ProjectMeta => ({
  id,
  name: id,
  createdAt: 1,
  updatedAt,
})

const writeRaw = (db: ProjectsDb, id: string, value: unknown) =>
  db.write(id, value as ReturnType<typeof createEmptyDocument>)

test('a project saved comes back, most recently touched first', async () => {
  const db = await fresh()

  await db.put(meta('chata', 10))
  await db.put(meta('byt', 20))

  expect((await db.list()).map((project) => project.id)).toEqual(['byt', 'chata'])
  expect(await db.meta('chata')).toEqual(meta('chata', 10))
})

test('a document saved comes back', async () => {
  const db = await fresh()
  const doc = createEmptyDocument()

  await db.write('byt', doc)

  expect(await db.read('byt')).toEqual(doc)
})

test('nothing saved under that name means nothing to read', async () => {
  const db = await fresh()

  expect(await db.read('byt')).toBeUndefined()
  expect(await db.meta('byt')).toBeUndefined()
})

test('a document written by an older build is brought forward', async () => {
  const db = await fresh()
  const level = 'l1'
  await writeRaw(db, 'byt', {
    version: 1,
    levels: { [level]: { id: level, name: 'Ground floor', elevation: 0, height: 2800 } },
    nodes: {},
    walls: {},
    openings: {},
    roomLabels: { r1: { id: 'r1', level, x: 1, y: 1, name: 'kuchyň' } },
    devices: {},
    circuits: {},
  })

  const doc = await db.read('byt')

  expect(doc?.version).toBe(DOCUMENT_VERSION)
  expect(doc?.rooms.r1?.name).toBe('kuchyň')
})

test('junk where a document should be is ignored rather than thrown', async () => {
  const db = await fresh()
  await writeRaw(db, 'byt', 'not a document at all')

  expect(await db.read('byt')).toBeUndefined()
})

test('a document from a newer build is ignored, not half-read', async () => {
  const db = await fresh()
  await writeRaw(db, 'byt', { ...createEmptyDocument(), version: 99 })

  expect(await db.read('byt')).toBeUndefined()
})

test('removing a project takes its document with it', async () => {
  const db = await fresh()
  await db.put(meta('byt'))
  await db.write('byt', createEmptyDocument())

  await db.remove('byt')

  expect(await db.list()).toEqual([])
  expect(await db.read('byt')).toBeUndefined()
})

test('a database that will not open answers empty rather than throwing', async () => {
  const sealed = {
    open: () => {
      throw new Error('access denied')
    },
  } as unknown as IDBFactory
  const db = await openProjects(sealed)

  expect(await db.list()).toEqual([])
  expect(await db.read('byt')).toBeUndefined()
  await expect(db.write('byt', createEmptyDocument())).resolves.toBeUndefined()
  await expect(db.put(meta('byt'))).resolves.toBeUndefined()
  await expect(db.remove('byt')).resolves.toBeUndefined()
})
