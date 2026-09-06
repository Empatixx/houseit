import type { HouseDocument } from '@houseit/core/document'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

type PreviewState = {
  doc: HouseDocument | null
  refused: string | null
  show: (doc: HouseDocument) => void
  refuse: (message: string) => void
  clear: () => void
}

export const previewStore = createStore<PreviewState>()((set) => ({
  doc: null,
  refused: null,
  show: (doc) => set({ doc, refused: null }),
  refuse: (message) => set({ refused: message }),
  clear: () => set({ doc: null, refused: null }),
}))

export function usePreview<T>(selector: (state: PreviewState) => T): T {
  return useStore(previewStore, selector)
}
