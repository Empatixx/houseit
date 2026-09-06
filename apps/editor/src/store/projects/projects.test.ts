import { createEmptyDocument } from '@houseit/core/document'
import { IDBFactory as FakeIndexedDb } from 'fake-indexeddb'
import { expect, test } from 'vitest'
import { createDocumentStore } from '../document-store'
import { WRITE_DELAY } from './autosave'
import { openProjects, type ProjectsDb } from './db'
import { createProjectsStore } from './projects'

function fresh() {
  const docs = createDocumentStore()
  const store = createProjectsStore(() => openProjects(new FakeIndexedDb()), docs)
  return { docs, store, at: store.getState }
}

function over(db: ProjectsDb) {
  const docs = createDocumentStore()
  const store = createProjectsStore(() => Promise.resolve(db), docs)
  return { docs, at: store.getState }
}

const ROOM =
  'add-room --material tile-white --shape rectangle --width 4000 --depth 3000 --name kitchen'
const after = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

test('a new project gets an id from its name and a plan of its own', async () => {
  const { store, at } = fresh()

  const meta = await at().create('Byt Praha')

  expect(meta.id).toBe('byt-praha')
  expect(store.getState().list?.map((project) => project.id)).toEqual(['byt-praha'])
})

test('a project with nothing for a name is still a project', async () => {
  const { at } = fresh()

  expect((await at().create('   ')).name).toBe('Untitled')
})

test('opening a project puts its plan on the screen', async () => {
  const { docs, at } = fresh()
  const meta = await at().create('Byt')
  await at().openProject(meta.id)
  docs.getState().exec(ROOM)
  await at().closeProject()

  await at().openProject(meta.id)

  expect(Object.keys(docs.getState().doc.walls)).toHaveLength(4)
  expect(at().open?.id).toBe(meta.id)
})

test('opening a project leaves no history behind it', async () => {
  const { docs, at } = fresh()
  const meta = await at().create('Byt')
  await at().openProject(meta.id)
  docs.getState().exec(ROOM)
  expect(docs.getState().canUndo).toBe(true)

  await at().openProject(meta.id)

  expect(docs.getState().canUndo).toBe(false)
})

test('a project that is not there does not open', async () => {
  const { at } = fresh()

  expect(await at().openProject('nowhere')).toBeUndefined()
  expect(at().open).toBeNull()
})

test('leaving a project takes the plan off the screen', async () => {
  const { docs, at } = fresh()
  const meta = await at().create('Byt')
  await at().openProject(meta.id)
  docs.getState().exec(ROOM)

  await at().closeProject()

  expect(at().open).toBeNull()
  expect(Object.keys(docs.getState().doc.walls)).toHaveLength(0)
})

test('the plan of the project that is open is written back as it is edited', async () => {
  const { docs, at } = fresh()
  const meta = await at().create('Byt')
  await at().openProject(meta.id)

  docs.getState().exec(ROOM)
  await after(WRITE_DELAY + 150)
  await at().closeProject()

  await at().openProject(meta.id)
  expect(Object.keys(docs.getState().doc.walls)).toHaveLength(4)
})

test('one project’s plan is not written into another', async () => {
  const { docs, at } = fresh()
  const byt = await at().create('Byt')
  const chata = await at().create('Chata')
  await at().openProject(byt.id)
  docs.getState().exec(ROOM)

  await at().openProject(chata.id)
  await after(WRITE_DELAY + 150)
  await at().closeProject()

  await at().openProject(chata.id)
  expect(Object.keys(docs.getState().doc.walls)).toHaveLength(0)
})

test('renaming keeps the id, and the open project hears about it', async () => {
  const { at } = fresh()
  const meta = await at().create('Byt')
  await at().openProject(meta.id)

  await at().rename(meta.id, 'Byt Praha')

  expect(at().open).toEqual({ ...meta, name: 'Byt Praha' })
  expect(at().open?.id).toBe('byt')
})

test('a project cannot be renamed to nothing', async () => {
  const { at } = fresh()
  const meta = await at().create('Byt')

  await at().rename(meta.id, '  ')

  await at().refresh()
  expect(at().list?.[0]?.name).toBe('Byt')
})

test('removing gives back what was removed, and restoring puts it back', async () => {
  const { docs, at } = fresh()
  const meta = await at().create('Byt')
  await at().openProject(meta.id)
  docs.getState().exec(ROOM)
  await after(WRITE_DELAY + 150)

  const removed = await at().remove(meta.id)
  expect(removed?.meta.name).toBe('Byt')
  expect(at().list).toEqual([])
  expect(at().open).toBeNull()

  if (removed) await at().restore(removed)

  expect(at().list?.map((project) => project.id)).toEqual(['byt'])
  await at().openProject(meta.id)
  expect(Object.keys(docs.getState().doc.walls)).toHaveLength(4)
})

test('removing a project that is not there gives back nothing', async () => {
  const { at } = fresh()

  expect(await at().remove('nowhere')).toBeUndefined()
})

test('a plan written by an older build is brought forward as it is opened', async () => {
  const db = await openProjects(new FakeIndexedDb())
  await db.put({ id: 'byt', name: 'Byt', createdAt: 1, updatedAt: 1 })
  await db.write('byt', {
    version: 1,
    levels: { l1: { id: 'l1', name: 'Ground floor', elevation: 0, height: 2800 } },
    nodes: {},
    walls: {},
    openings: {},
    roomLabels: { r1: { id: 'r1', level: 'l1', x: 1, y: 1, name: 'kuchyň' } },
    devices: {},
    circuits: {},
  } as never)
  const { docs, at } = over(db)

  expect(await at().openProject('byt')).toBeDefined()
  expect(docs.getState().doc.rooms.r1?.name).toBe('kuchyň')
})

test('a plan that cannot be read is refused, not opened empty over the top of it', async () => {
  const db = await openProjects(new FakeIndexedDb())
  await db.put({ id: 'byt', name: 'Byt', createdAt: 1, updatedAt: 1 })
  await db.write('byt', 'not a document at all' as never)
  const { at } = over(db)

  expect(await at().openProject('byt')).toBeUndefined()
  expect(at().open).toBeNull()
})

test('a plan from a newer build is refused rather than half-read', async () => {
  const db = await openProjects(new FakeIndexedDb())
  await db.put({ id: 'byt', name: 'Byt', createdAt: 1, updatedAt: 1 })
  await db.write('byt', { ...createEmptyDocument(), version: 99 } as never)
  const { at } = over(db)

  expect(await at().openProject('byt')).toBeUndefined()
})

test('a picture of the plan is kept with the project and shown in the list', async () => {
  const { store, at } = fresh()
  const meta = await at().create('Byt')

  await at().picture(meta.id, 'data:image/jpeg;base64,AAAA')

  expect(store.getState().list?.[0]?.picture).toBe('data:image/jpeg;base64,AAAA')
  await at().refresh()
  expect(store.getState().list?.[0]?.picture).toBe('data:image/jpeg;base64,AAAA')
})
