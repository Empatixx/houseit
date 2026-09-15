import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { DocumentState } from '../document-store'
import { createWriter, type SaveState } from './autosave'
import { documentCodec, type ProjectCodec } from './codec'
import type { ProjectMeta, ProjectsDb } from './db'
import { slugOf } from './slug'

const UNTITLED = 'Untitled'

type Removed = { meta: ProjectMeta; stored: unknown }

export type ProjectsState = {
  list: ProjectMeta[] | undefined
  open: ProjectMeta | null
  saveState: SaveState
  refresh: () => Promise<void>
  create: (name: string, initial?: HouseDocument) => Promise<ProjectMeta>
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
  docs: StoreApi<DocumentState>,
  codec: ProjectCodec = documentCodec,
): StoreApi<ProjectsState> {
  let opened: Promise<ProjectsDb> | undefined
  const db = () => {
    opened ??= open().catch((error: unknown) => {
      opened = undefined
      throw error
    })
    return opened
  }
  const writer = createWriter(db, codec.encode, (saveState) => store.setState({ saveState }))

  let transition: Promise<unknown> = Promise.resolve()
  const serial = <T>(run: () => Promise<T>): Promise<T> => {
    const next = transition.catch(() => {}).then(run)
    transition = next
    return next
  }
  const close = async () => {
    if (!store.getState().open) return
    await writer.flush()
    store.setState({ open: null })
    docs.getState().reset()
  }

  const store = createStore<ProjectsState>()((set, get) => ({
    list: undefined,
    open: null,
    saveState: { status: 'saved' },

    refresh: async () => {
      set({ list: await (await db()).list() })
    },

    create: async (name, initial = createEmptyDocument()) => {
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
      await database.write(meta.id, await codec.encode(meta.id, initial))
      await database.put(meta)
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
        const state = docs.getState()
        writer.schedule(id, state.doc, state.level, codec.capture?.(state.authoring))
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
      await database.remove(id)
      set((state) => ({ list: state.list?.filter((project) => project.id !== id) }))
      return { meta, stored }
    },

    restore: async ({ meta, stored }) => {
      const database = await db()
      if (stored !== undefined) await database.write(meta.id, stored)
      await database.put(meta)
      await get().refresh()
    },
  }))

  docs.subscribe((state, previous) => {
    if (state.doc === previous.doc) return
    const open = store.getState().open
    if (open) writer.schedule(open.id, state.doc, state.level, codec.capture?.(state.authoring))
  })

  return store
}
