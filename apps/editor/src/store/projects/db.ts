import type { Outline } from './outline'

const DB_NAME = 'houseit'
const VERSION = 1
const PROJECTS = 'projects'
const DOCUMENTS = 'documents'

export type ProjectMeta = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  outline?: Outline
  picture?: string
}

export type ProjectsDb = {
  list(): Promise<ProjectMeta[]>
  meta(id: string): Promise<ProjectMeta | undefined>
  put(meta: ProjectMeta): Promise<void>
  read(id: string): Promise<unknown>
  write(id: string, doc: unknown): Promise<void>
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
      return undefined
    }
  }

  const changing = async (
    stores: string[],
    change: (transaction: IDBTransaction) => void,
  ): Promise<void> => {
    if (!db) throw new Error('Project storage is unavailable')
    const transaction = db.transaction(stores, 'readwrite')
    change(transaction)
    await finished(transaction)
  }

  return {
    list: async () => {
      const all = (await asking<ProjectMeta[]>(PROJECTS, (shelf) => shelf.getAll())) ?? []
      return all.sort((a, b) => b.updatedAt - a.updatedAt)
    },

    meta: (id) => asking<ProjectMeta | undefined>(PROJECTS, (shelf) => shelf.get(id)),

    put: (meta) => changing([PROJECTS], (tx) => void tx.objectStore(PROJECTS).put(meta)),

    read: (id) => asking<unknown>(DOCUMENTS, (shelf) => shelf.get(id)),

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
      if (!db.objectStoreNames.contains(PROJECTS)) db.createObjectStore(PROJECTS, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(DOCUMENTS)) db.createObjectStore(DOCUMENTS)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('the database is open in another tab'))
  })
}

const answered = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const finished = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
