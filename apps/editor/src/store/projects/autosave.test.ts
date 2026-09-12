import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { IDBFactory as FakeIndexedDb } from 'fake-indexeddb'
import { expect, test } from 'vitest'
import { createWriter, WRITE_DELAY } from './autosave'
import { openProjects, type ProjectMeta, type ProjectsDb } from './db'

const fresh = () => openProjects(new FakeIndexedDb())
const meta: ProjectMeta = { id: 'byt', name: 'Byt', createdAt: 1, updatedAt: 1 }

function withWall(): HouseDocument {
  const doc = createEmptyDocument()
  const level = Object.keys(doc.levels)[0] as string
  doc.nodes.a = { id: 'a', x: 0, y: 0 }
  doc.nodes.b = { id: 'b', x: 4000, y: 0 }
  doc.walls.w = { id: 'w', level, a: 'a', b: 'b', thickness: 150, baseOffset: 0, height: 2600 }
  return doc
}

const levelOf = (doc: HouseDocument) => Object.keys(doc.levels)[0] as string

async function started(): Promise<{ db: ProjectsDb; writer: ReturnType<typeof createWriter> }> {
  const db = await fresh()
  await db.put(meta)
  return { db, writer: createWriter(() => Promise.resolve(db)) }
}

const after = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const WRITTEN = WRITE_DELAY + 150

test('an edit is written once the plan is left alone', async () => {
  const { db, writer } = await started()
  const doc = createEmptyDocument()

  writer.schedule(meta.id, doc, levelOf(doc))
  expect(await db.read(meta.id)).toBeUndefined()

  await after(WRITTEN)

  expect(await db.read(meta.id)).toEqual(doc)
})

test('a burst of edits is one write, of the last of them', async () => {
  const { db, writer } = await started()
  const first = createEmptyDocument()
  const last = withWall()

  writer.schedule(meta.id, first, levelOf(first))
  await after(WRITE_DELAY / 2)
  writer.schedule(meta.id, last, levelOf(last))
  expect(await db.read(meta.id)).toBeUndefined()

  await after(WRITTEN)

  expect(await db.read(meta.id)).toEqual(last)
})

test('the project is touched, and its outline drawn again', async () => {
  const { db, writer } = await started()
  const doc = withWall()

  writer.schedule(meta.id, doc, levelOf(doc))
  await after(WRITTEN)

  const written = await db.meta(meta.id)
  expect(written?.updatedAt).toBeGreaterThan(meta.updatedAt)
  expect(written?.outline?.width).toBe(4000)
})

test('a project renamed while its plan was waiting keeps the new name', async () => {
  const { db, writer } = await started()
  const doc = createEmptyDocument()

  writer.schedule(meta.id, doc, levelOf(doc))
  await db.put({ ...meta, name: 'Byt Praha' })
  await after(WRITTEN)

  expect((await db.meta(meta.id))?.name).toBe('Byt Praha')
})

test('flushing writes what is waiting without waiting for the clock', async () => {
  const { db, writer } = await started()
  const doc = createEmptyDocument()

  writer.schedule(meta.id, doc, levelOf(doc))
  await writer.flush()

  expect(await db.read(meta.id)).toEqual(doc)
})

test('flushing with nothing waiting is nothing at all', async () => {
  const { writer } = await started()

  await expect(writer.flush()).resolves.toBeUndefined()
})

test('slow encoding cannot overwrite a newer revision or mix its outline', async () => {
  const db = await fresh()
  await db.put(meta)
  const first = createEmptyDocument(),
    last = withWall()
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const encoded: HouseDocument[] = []
  const writer = createWriter(
    async () => db,
    async (_id, doc) => {
      encoded.push(doc)
      if (doc === first) await gate
      return { format: 'test-archive', doc }
    },
  )
  writer.schedule(meta.id, first, levelOf(first))
  const a = writer.flush()
  writer.schedule(meta.id, last, levelOf(last))
  const b = writer.flush()
  release()
  await Promise.all([a, b])
  expect(encoded).toEqual([first, last])
  expect(await db.read(meta.id)).toEqual({ format: 'test-archive', doc: last })
  expect((await db.meta(meta.id))?.outline?.width).toBe(4000)
})

test('flush also writes an edit arriving while the previous encoding is running', async () => {
  const db = await fresh()
  const first = createEmptyDocument(),
    last = withWall()
  let release!: () => void
  let started!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const began = new Promise<void>((resolve) => {
    started = resolve
  })
  const writer = createWriter(
    async () => db,
    async (_id, doc) => {
      if (doc === first) {
        started()
        await gate
      }
      return doc
    },
  )
  writer.schedule(meta.id, first, levelOf(first))
  const flushing = writer.flush()
  await began
  writer.schedule(meta.id, last, levelOf(last))
  release()
  await flushing
  expect(await db.read(meta.id)).toEqual(last)
})

test('a failed revision is retryable and cannot reappear after a newer save', async () => {
  const db = await fresh()
  const first = createEmptyDocument(),
    last = withWall()
  let fail = true
  const writer = createWriter(
    async () => db,
    async (_id, doc) => {
      if (fail) throw new Error('worker failed')
      return doc
    },
  )
  writer.schedule(meta.id, first, levelOf(first))
  await expect(writer.flush()).rejects.toThrow('worker failed')
  fail = false
  await writer.flush()
  expect(await db.read(meta.id)).toEqual(first)
  fail = true
  writer.schedule(meta.id, first, levelOf(first))
  const failed = writer.flush()
  writer.schedule(meta.id, last, levelOf(last))
  const newer = writer.flush()
  await expect(failed).rejects.toThrow('worker failed')
  fail = false
  await newer.catch(() => {})
  await writer.flush()
  expect(await db.read(meta.id)).toEqual(last)
})
