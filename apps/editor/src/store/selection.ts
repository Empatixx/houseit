import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

/** What is picked on the plan: a room by its record, a thing standing in one, a door or window, or a wall. */
export type Selection =
  | { kind: 'room'; id: string }
  | { kind: 'object'; id: string }
  | { kind: 'opening'; id: string }
  | { kind: 'wall'; id: string }

type SelectionState = {
  selected: Selection | null
  /** Every room's dimensions at once, rather than only the picked one's. */
  showAll: boolean
  select: (selection: Selection | null) => void
  toggleAll: () => void
  showDimensions: (all: boolean) => void
}

/**
 * What is picked lives beside the document, not in it. Picking is a matter of
 * the sitting — it is not undone, not saved, and the agent never sees it.
 */
export const selectionStore = createStore<SelectionState>()((set) => ({
  selected: null,
  showAll: false,
  select: (selected) => set({ selected }),
  toggleAll: () => set((state) => ({ showAll: !state.showAll })),
  showDimensions: (showAll) => set({ showAll }),
}))

export function useSelection<T>(selector: (state: SelectionState) => T): T {
  return useStore(selectionStore, selector)
}
