import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

export type Selection =
  | { kind: 'room'; id: string }
  | { kind: 'object'; id: string }
  | { kind: 'opening'; id: string }
  | { kind: 'wall'; id: string }

type SelectionState = {
  selected: Selection | null
  showAll: boolean
  select: (selection: Selection | null) => void
  toggleAll: () => void
  showDimensions: (all: boolean) => void
}

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
