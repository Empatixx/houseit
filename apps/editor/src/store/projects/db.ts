import type { HouseDocument } from '@houseit/core/document'
import { migrateDocument } from '@houseit/core/migrate'
import type { Outline } from './outline'

/** The database every project lives in, and the two shelves inside it. */
const DB_NAME = 'houseit'
const VERSION = 1
const PROJECTS = 'projects'
const DOCUMENTS = 'documents'

/** What is known about a project without opening it. */
export type ProjectMeta = {
  /** Made from the name when the project is, and never changed again. */
  id: string
  name: string
  createdAt: number
  updatedAt: number
  /** The walls, for the card. Absent while nothing has been drawn. */
  outline?: Outline
}

/**
 * The plans, kept in the browser between visits.
 *
 * Two shelves rather than one, because the home screen lists projects and must
 * not read every plan to do it: a name and a date and a handful of lines are a
 * card, and the document behind it is only fetched when the project is entered.
 *
 * Everything here shrugs rather than throws, as the one localStorage key it
 * replaces did. The database can be missing, blocked in a private window, open
 * in another tab at a version this build does not know, or full. None of that
 * is a reason to take the editor down: a plan that cannot be read is a plan you
 * start again, and that beats a blank screen with an exception behind it.
 */
export type ProjectsDb = {
  /** Every project, most recently touched first. */
  list(): Promise<ProjectMeta[]>
  meta(id: string): Promise<ProjectMeta | undefined>
  put(meta: ProjectMeta): Promise<void>
  read(id: string): Promise<HouseDocument | undefined>
  write(id: string, doc: HouseDocument): Promise<void>
  /** The project and its plan, both. */
  remove(id: string): Promise<void>
}

export async function openProjects(
  factory: IDBFactory | undefined = globalThis.indexedDB,
): Promise<ProjectsDb> {
  const db = await open(factory).catch(() => undefined)

  const asking = async <T>(
    store: string,
    ask: (shelf: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T | undefined> => {
    if (!db) return undefined
    try {
      return await answered(ask(db.transaction(store, 'readonly').objectStore(store)))
    } catch {
      // Gone, or never made. Either way there is nothing under that name.
      return undefined
    }
  }

  const changing = async (
    stores: string[],
    change: (transaction: IDBTransaction) => void,
  ): Promise<void> => {
    if (!db) return
    try {
      const transaction = db.transaction(stores, 'readwrite')
      change(transaction)
      await finished(transaction)
    } catch {
      // Full, or blocked. The plan is still on screen; it just will not be here next time.
    }
  }

  return {
    list: async () => {
      const all = (await asking<ProjectMeta[]>(PROJECTS, (shelf) => shelf.getAll())) ?? []
      return all.sort((a, b) => b.updatedAt - a.updatedAt)
    },

    meta: (id) => asking<ProjectMeta | undefined>(PROJECTS, (shelf) => shelf.get(id)),

    put: (meta) => changing([PROJECTS], (tx) => void tx.objectStore(PROJECTS).put(meta)),

    read: async (id) => {
      const stored = await asking<unknown>(DOCUMENTS, (shelf) => shelf.get(id))
      if (stored === undefined) return undefined
      try {
        return migrateDocument(stored)
      } catch {
        // Junk, or a document from a build newer than this one. Not ours to read.
        return undefined
      }
    },

    write: (id, doc) => changing([DOCUMENTS], (tx) => void tx.objectStore(DOCUMENTS).put(doc, id)),

    remove: (id) =>
      changing([PROJECTS, DOCUMENTS], (tx) => {
        tx.objectStore(PROJECTS).delete(id)
        tx.objectStore(DOCUMENTS).delete(id)
      }),
  }
}

function open(factory: IDBFactory | undefined): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!factory) throw new Error('there is no IndexedDB here')
    const request = factory.open(DB_NAME, VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      // The metadata is keyed by the id it carries; a document is keyed by its
      // project's id and is otherwise none of the database's business.
      if (!db.objectStoreNames.contains(PROJECTS)) db.createObjectStore(PROJECTS, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(DOCUMENTS)) db.createObjectStore(DOCUMENTS)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    // Another tab holds it open at an older version and will not let go.
    request.onblocked = () => reject(new Error('the database is open in another tab'))
  })
}

const answered = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

/**
 * A write is done when its transaction is, not when its request comes back —
 * a tab closed in between would take the change with it.
 */
const finished = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
