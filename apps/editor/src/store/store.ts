import { useStore } from 'zustand'
import { createDocumentStore, type DocumentState } from './document-store'
import { loadDocument, saveDocument } from './persistence'

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
