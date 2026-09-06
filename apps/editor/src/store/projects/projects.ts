import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { migrateDocument } from '@houseit/core/migrate'
import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { DocumentState } from '../document-store'
import { documentStore } from '../store'
import { createWriter } from './autosave'
import { openProjects, type ProjectMeta, type ProjectsDb } from './db'
import { importLocalPlan } from './import-local'
import { slugOf } from './slug'

const UNTITLED = 'Untitled'

type Removed = { meta: ProjectMeta; doc: HouseDocument | undefined }

export type ProjectsState = {
  list: ProjectMeta[] | undefined
  open: ProjectMeta | null
  refresh: () => Promise<void>
  create: (name: string) => Promise<ProjectMeta>
  openProject: (id: string) => Promise<ProjectMeta | undefined>
  closeProject: () => Promise<void>
  save: () => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  picture: (id: string, image: string) => Promise<void>
  remove: (id: string) => Promise<Removed | undefined>
  restore: (removed: Removed) => Promise<void>
}

export function createProjectsStore(
  open: () => Promise<ProjectsDb>,
  docs: StoreApi<DocumentState> = documentStore,
): StoreApi<ProjectsState> {
  let opened: Promise<ProjectsDb> | undefined
  const db = () => (opened ??= open())
  const writer = createWriter(db)

  const store = createStore<ProjectsState>()((set, get) => ({
    list: undefined,
    open: null,

    refresh: async () => {
      set({ list: await (await db()).list() })
    },

    create: async (name) => {
      const database = await db()
      const list = await database.list()
      const called = name.trim() || UNTITLED
      const now = Date.now()
      const meta: ProjectMeta = {
        id: slugOf(
          called,
          list.map((project) => project.id),
        ),
        name: called,
        createdAt: now,
        updatedAt: now,
      }
      await database.put(meta)
      await database.write(meta.id, createEmptyDocument())
      set({ list: [meta, ...list] })
      return meta
    },

    openProject: async (id) => {
      await get().closeProject()
      const database = await db()
      const meta = await database.meta(id)
      if (!meta) return undefined
      const stored = await database.read(id)
      const doc = stored === undefined ? createEmptyDocument() : readable(stored)
      if (!doc) return undefined
      docs.getState().load(doc)
      set({ open: meta })
      return meta
    },

    save: () => writer.flush(),

    closeProject: async () => {
      if (!get().open) return
      await writer.flush()
      set({ open: null })
      docs.getState().reset()
    },

    rename: async (id, name) => {
      const called = name.trim()
      if (!called) return
      const database = await db()
      const meta = await database.meta(id)
      if (!meta) return
      const renamed = { ...meta, name: called }
      await database.put(renamed)
      set((state) => ({
        list: state.list?.map((project) => (project.id === id ? renamed : project)),
        open: state.open?.id === id ? renamed : state.open,
      }))
    },

    picture: async (id, image) => {
      const database = await db()
      const meta = await database.meta(id)
      if (!meta) return
      const pictured = { ...meta, picture: image }
      await database.put(pictured)
      set((state) => ({
        list: state.list?.map((project) => (project.id === id ? pictured : project)),
      }))
    },

    remove: async (id) => {
      if (get().open?.id === id) await get().closeProject()
      const database = await db()
      const meta = await database.meta(id)
      if (!meta) return undefined
      const stored = await database.read(id)
      const doc = stored === undefined ? undefined : readable(stored)
      await database.remove(id)
      set((state) => ({ list: state.list?.filter((project) => project.id !== id) }))
      return { meta, doc }
    },

    restore: async ({ meta, doc }) => {
      const database = await db()
      await database.put(meta)
      if (doc) await database.write(meta.id, doc)
      await get().refresh()
    },
  }))

  docs.subscribe((state, previous) => {
    if (state.doc === previous.doc) return
    const open = store.getState().open
    if (open) writer.schedule(open.id, state.doc, state.level)
  })

  return store
}

export const projectsStore = createProjectsStore(async () => {
  const db = await openProjects()
  await importLocalPlan(db)
  return db
})

function readable(stored: unknown): HouseDocument | undefined {
  try {
    return migrateDocument(stored)
  } catch {
    return undefined
  }
}

export function useProjects<T>(selector: (state: ProjectsState) => T): T {
  return useStore(projectsStore, selector)
}
