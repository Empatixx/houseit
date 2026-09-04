import { migrateDocument } from '@houseit/core/migrate'
import type { ProjectsDb } from './db'
import { outlineOf } from './outline'

/** Where the one and only plan used to live, before there were projects. */
export const LEGACY_KEY = 'houseit.document'

/** What the plan that was already here is called once it becomes a project. */
const FIRST = { id: 'my-plan', name: 'My plan' }

/**
 * The one-time lift of the old single plan out of localStorage.
 *
 * Runs at start-up, before anything is shown. The guard is an empty table
 * rather than a flag: if the key cannot be let go of afterwards, the next start
 * still finds a project and leaves it alone, so nobody ends up with two copies
 * of the same plan.
 */
export async function importLocalPlan(
  db: ProjectsDb,
  store: Storage | undefined = localStore(),
): Promise<void> {
  if ((await db.list()).length > 0) return

  let stored: string | null = null
  try {
    stored = store?.getItem(LEGACY_KEY) ?? null
  } catch {
    // A private window, or storage switched off. There was nothing to lift.
    return
  }
  if (!stored) return

  let doc: ReturnType<typeof migrateDocument>
  try {
    doc = migrateDocument(JSON.parse(stored))
  } catch {
    // Junk, or a plan from a newer build. Left where it is rather than thrown away.
    return
  }

  const now = Date.now()
  const level = Object.keys(doc.levels)[0] ?? ''
  await db.put({ ...FIRST, createdAt: now, updatedAt: now, outline: outlineOf(doc, level) })
  await db.write(FIRST.id, doc)

  try {
    store?.removeItem(LEGACY_KEY)
  } catch {
    // It is in the database now; the old key is only clutter.
  }
}

function localStore(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}
