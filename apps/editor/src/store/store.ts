import type { HouseDocument } from '@houseit/core/document'
import { useStore } from 'zustand'
import { createDocumentStore, type DocumentState } from './document-store'
import { usePreview } from './preview'

/**
 * The editor's single document: whichever project is open is loaded into it,
 * and written back from it by `store/projects`. Tests build their own with
 * `createDocumentStore`.
 */
export const documentStore = createDocumentStore()

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
