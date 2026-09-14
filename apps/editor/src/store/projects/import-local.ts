import { migrateDocument } from '@houseit/core/migrate'
import type { ProjectsDb } from './db'
import { outlineOf } from './outline'

export const LEGACY_KEY = 'houseit.document'

const FIRST = { id: 'my-plan', name: 'My plan' }

export async function importLocalPlan(
  db: ProjectsDb,
  store: Storage | undefined = localStore(),
): Promise<void> {
  if ((await db.list()).length > 0) return

  let stored: string | null = null
  try {
    stored = store?.getItem(LEGACY_KEY) ?? null
  } catch {
    return
  }
  if (!stored) return

  let doc: ReturnType<typeof migrateDocument>
  try {
    doc = migrateDocument(JSON.parse(stored))
  } catch {
    return
  }

  const now = Date.now()
  const level = Object.keys(doc.levels)[0] ?? ''
  await db.write(FIRST.id, doc)
  await db.put({ ...FIRST, createdAt: now, updatedAt: now, outline: outlineOf(doc, level) })

  try {
    store?.removeItem(LEGACY_KEY)
  } catch {}
}

function localStore(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}
