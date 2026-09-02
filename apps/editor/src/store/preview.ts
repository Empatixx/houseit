import type { HouseDocument } from '@houseit/core/document'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

type PreviewState = {
  /** The plan as it would be if the pointer let go now, or nothing when nothing is held. */
  doc: HouseDocument | null
  /** Why the plan would refuse where the pointer is now, if it would. */
  refused: string | null
  show: (doc: HouseDocument) => void
  refuse: (message: string) => void
  clear: () => void
}

/**
 * A wall carried across the plan takes the rooms with it: the floors either
 * side grow and shrink, the walls meeting it stretch, the labels move. So the
 * drawing does not move the wall; it runs the command the drop would run,
 * on a copy, and draws that. Nothing here reaches the document.
 */
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
