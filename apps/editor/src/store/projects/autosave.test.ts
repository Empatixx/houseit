import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import FDBFactory from 'fake-indexeddb/lib/FDBFactory'
import { expect, test } from 'vitest'
import { createWriter, WRITE_DELAY } from './autosave'
import { openProjects, type ProjectMeta, type ProjectsDb } from './db'

const fresh = () => openProjects(new FDBFactory() as unknown as IDBFactory)
const meta: ProjectMeta = { id: 'byt', name: 'Byt', createdAt: 1, updatedAt: 1 }

/** A plan with one wall in it, so there is an outline to find. */
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
  return { db, writer: createWriter(Promise.resolve(db)) }
}

/**
 * Real time rather than a fake clock: fake-indexeddb runs its transactions on
 * the same timers, and a faked clock stops the database dead.
 */
const after = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
/** Enough past the delay that the write has landed, whatever the machine is doing. */
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
