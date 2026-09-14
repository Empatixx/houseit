import { createEmptyDocument } from '@houseit/core/document'
import { IDBFactory as FakeIndexedDb, IDBObjectStore } from 'fake-indexeddb'
import { expect, test, vi } from 'vitest'
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

test('a document comes back exactly as it was stored, unjudged', async () => {
  const db = await fresh()
  const older = { version: 1, roomLabels: { r1: { id: 'r1', name: 'kuchyň' } } }

  await writeRaw(db, 'byt', older)

  expect(await db.read('byt')).toEqual(older)
})

test('removing a project takes its document with it', async () => {
  const db = await fresh()
  await db.put(meta('byt'))
  await db.write('byt', createEmptyDocument())

  await db.remove('byt')

  expect(await db.list()).toEqual([])
  expect(await db.read('byt')).toBeUndefined()
})

test('an unavailable database rejects instead of reporting an empty project list', async () => {
  const sealed = {
    open: () => {
      throw new Error('access denied')
    },
  } as unknown as IDBFactory
  await expect(openProjects(sealed)).rejects.toThrow('access denied')
})

test('a failed read rejects instead of reporting a missing document', async () => {
  const db = await fresh()
  const doc = createEmptyDocument()
  await db.write('byt', doc)
  const get = vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementationOnce(() => {
    throw new Error('read failed')
  })
  try {
    await expect(db.read('byt')).rejects.toThrow('read failed')
  } finally {
    get.mockRestore()
  }
  expect(await db.read('byt')).toEqual(doc)
})

test('an aborted write rejects instead of reporting success', async () => {
  const db = await fresh()
  const put = IDBObjectStore.prototype.put
  const abort = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(function (
    this: IDBObjectStore,
    ...args
  ) {
    const request = put.apply(this, args)
    this.transaction.abort()
    return request
  })
  try {
    await expect(db.write('byt', createEmptyDocument())).rejects.toBeDefined()
    expect(await db.read('byt')).toBeUndefined()
  } finally {
    abort.mockRestore()
  }
})
