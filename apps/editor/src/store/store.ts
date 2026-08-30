import { useStore } from 'zustand'
import { createDocumentStore, type DocumentState } from './document-store'

/** The editor's single document. Tests build their own with `createDocumentStore`. */
export const documentStore = createDocumentStore()

export function useDocument<T>(selector: (state: DocumentState) => T): T {
  return useStore(documentStore, selector)
}
