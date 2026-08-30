import type { HouseDocument } from '@houseit/core/document'
import { migrateDocument } from '@houseit/core/migrate'

export const STORAGE_KEY = 'houseit.document'

/**
 * The plan, kept in the browser between visits.
 *
 * Everything here shrugs rather than throws. Storage can be missing, full,
 * switched off in a private window, or hold a document from a build that is not
 * this one — none of which is a reason to take the editor down. A plan that
 * cannot be read is a plan you start again, and that is better than a blank
 * screen with an exception behind it.
 */
export function loadDocument(store: Storage | undefined = storage()): HouseDocument | undefined {
  try {
    const stored = store?.getItem(STORAGE_KEY)
    return stored ? migrateDocument(JSON.parse(stored)) : undefined
  } catch {
    return undefined
  }
}

export function saveDocument(doc: HouseDocument, store: Storage | undefined = storage()): void {
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(doc))
  } catch {
    // Full, or blocked. The plan is still on screen; it just will not be here next time.
  }
}

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}
