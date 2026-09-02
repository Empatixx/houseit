import type { HouseDocument } from '@houseit/core/document'
import { useStore } from 'zustand'
import { createDocumentStore, type DocumentState } from './document-store'
import { loadDocument, saveDocument } from './persistence'
import { usePreview } from './preview'

/** The editor's single document. Tests build their own with `createDocumentStore`. */
export const documentStore = createDocumentStore(loadDocument())

// Written back on every change, so a reload picks up where the plan was left. The
// history is deliberately not stored: undo belongs to a sitting, not to a plan.
documentStore.subscribe((state, previous) => {
  if (state.doc !== previous.doc) saveDocument(state.doc)
})

export function useDocument<T>(selector: (state: DocumentState) => T): T {
  return useStore(documentStore, selector)
}

/**
 * The plan to draw: what is being previewed while something is carried, and
 * otherwise the document itself. Everything drawn reads this; everything that
 * changes the plan goes to the store.
 */
export function usePlanDoc(): HouseDocument {
  const doc = useDocument((state) => state.doc)
  const preview = usePreview((state) => state.doc)
  return preview ?? doc
}
