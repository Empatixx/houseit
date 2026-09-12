import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { toast } from 'sonner'
import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { DocumentState } from '../document-store'
import { documentStore } from '../store'
import { createWriter } from './autosave'
import { documentCodec, fragmentCodec, type ProjectCodec } from './codec'
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
  codec: ProjectCodec = documentCodec,
): StoreApi<ProjectsState> {
  let opened: Promise<ProjectsDb> | undefined
  const db = () => (opened ??= open())
  const writer = createWriter(db, codec.encode, (error) =>
    toast.error(
      `Project could not be saved: ${error instanceof Error ? error.message : String(error)}`,
      { id: 'project-save-error' },
    ),
  )

  let transition: Promise<unknown> = Promise.resolve()
  const serial = <T>(run: () => Promise<T>): Promise<T> => {
    const next = transition.catch(() => {}).then(run)
    transition = next
    return next
  }
  const close = async () => {
    if (!store.getState().open) return
    await writer.flush()
    await codec.close()
    store.setState({ open: null })
    docs.getState().reset()
  }

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
      await database.write(meta.id, await codec.encode(meta.id, createEmptyDocument()))
      set({ list: [meta, ...list] })
      return meta
    },

    openProject: (id) =>
      serial(async () => {
        await close()
        const database = await db()
        const meta = await database.meta(id)
        if (!meta) return undefined
        const stored = await database.read(id)
        const doc = stored === undefined ? createEmptyDocument() : await codec.decode(id, stored)
        if (!doc) return undefined
        docs.getState().load(doc)
        set({ open: meta })
        writer.schedule(id, doc, docs.getState().level)
        return meta
      }),

    save: () => writer.flush(),

    closeProject: () => serial(close),

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
      const doc = stored === undefined ? undefined : await codec.decode(id, stored)
      await database.remove(id)
      set((state) => ({ list: state.list?.filter((project) => project.id !== id) }))
      return { meta, doc }
    },

    restore: async ({ meta, doc }) => {
      const database = await db()
      await database.put(meta)
      if (doc) await database.write(meta.id, await codec.encode(meta.id, doc))
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

export const projectsStore = createProjectsStore(
  async () => {
    const db = await openProjects()
    await importLocalPlan(db)
    return db
  },
  documentStore,
  fragmentCodec(),
)

export function useProjects<T>(selector: (state: ProjectsState) => T): T {
  return useStore(projectsStore, selector)
}
