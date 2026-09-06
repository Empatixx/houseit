import type { HouseDocument } from '@houseit/core/document'
import { useStore } from 'zustand'
import { createDocumentStore, type DocumentState } from './document-store'
import { usePreview } from './preview'

export const documentStore = createDocumentStore()

export function useDocument<T>(selector: (state: DocumentState) => T): T {
  return useStore(documentStore, selector)
}

export function usePlanDoc(): HouseDocument {
  const doc = useDocument((state) => state.doc)
  const preview = usePreview((state) => state.doc)
  return preview ?? doc
}
