import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { DocumentState } from '../document-store'
import { documentStore } from '../store'
import { createWriter } from './autosave'
import { openProjects, type ProjectMeta, type ProjectsDb } from './db'
import { importLocalPlan } from './import-local'
import { slugOf } from './slug'

/** What a project is called when it is not called anything. */
const UNTITLED = 'Untitled'

/** A project and its plan, held on to for as long as it can be put back. */
export type Removed = { meta: ProjectMeta; doc: HouseDocument | undefined }

export type ProjectsState = {
  /** Every project, most recently touched first. Undefined until they have been read. */
  list: ProjectMeta[] | undefined
  /** The project being worked on, or null — which is what the home screen is. */
  open: ProjectMeta | null
  refresh: () => Promise<void>
  create: (name: string) => Promise<ProjectMeta>
  /** Loads a project's plan into the editor. Undefined if there is no such project. */
  openProject: (id: string) => Promise<ProjectMeta | undefined>
  /** Writes what is waiting, then takes the plan off the screen. */
  closeProject: () => Promise<void>
  /** A new name. The id it was given at the start stays what it was. */
  rename: (id: string, name: string) => Promise<void>
  /** Gives back what it took, so that it can be put back. */
  remove: (id: string) => Promise<Removed | undefined>
  restore: (removed: Removed) => Promise<void>
}

/**
 * Which project is open, and what there is to open.
 *
 * The plan itself is not in here: it is in the document store, where every
 * command and everything drawn already looks for it. This says which project
 * that plan belongs to, and moves it in and out of the database at the two
 * moments where that happens — entering a project, and leaving one.
 */
export function createProjectsStore(
  db: Promise<ProjectsDb>,
  docs: StoreApi<DocumentState> = documentStore,
): StoreApi<ProjectsState> {
  const writer = createWriter(db)

  const store = createStore<ProjectsState>()((set, get) => ({
    list: undefined,
    open: null,

    refresh: async () => {
      set({ list: await (await db).list() })
    },

    create: async (name) => {
      const database = await db
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
      // Whatever was open stops being written to before anything else moves.
      await get().closeProject()
      const database = await db
      const meta = await database.meta(id)
      if (!meta) return undefined
      docs.getState().load((await database.read(id)) ?? createEmptyDocument())
      // Only now: while `open` is null nothing is written back, so loading a
      // plan cannot be mistaken for editing the one that was open before.
      set({ open: meta })
      return meta
    },

    closeProject: async () => {
      if (!get().open) return
      await writer.flush()
      set({ open: null })
      docs.getState().reset()
    },

    rename: async (id, name) => {
      const called = name.trim()
      if (!called) return
      const database = await db
      const meta = await database.meta(id)
      if (!meta) return
      const renamed = { ...meta, name: called }
      await database.put(renamed)
      set((state) => ({
        list: state.list?.map((project) => (project.id === id ? renamed : project)),
        open: state.open?.id === id ? renamed : state.open,
      }))
    },

    remove: async (id) => {
      if (get().open?.id === id) await get().closeProject()
      const database = await db
      const meta = await database.meta(id)
      if (!meta) return undefined
      const doc = await database.read(id)
      await database.remove(id)
      set((state) => ({ list: state.list?.filter((project) => project.id !== id) }))
      return { meta, doc }
    },

    restore: async ({ meta, doc }) => {
      const database = await db
      await database.put(meta)
      if (doc) await database.write(meta.id, doc)
      await get().refresh()
    },
  }))

  // The open project's plan follows the document store, and nothing else does.
  docs.subscribe((state, previous) => {
    if (state.doc === previous.doc) return
    const open = store.getState().open
    if (open) writer.schedule(open.id, state.doc, state.level)
  })

  return store
}

/**
 * The editor's projects. Tests build their own with `createProjectsStore`.
 *
 * The plan that used to live in localStorage is lifted into the database as
 * part of opening it, so nothing can read the projects before it is one of
 * them.
 */
export const projectsStore = createProjectsStore(
  openProjects().then(async (db) => {
    await importLocalPlan(db)
    return db
  }),
)

export function useProjects<T>(selector: (state: ProjectsState) => T): T {
  return useStore(projectsStore, selector)
}
