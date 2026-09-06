import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

export type Selection =
  | { kind: 'room'; id: string }
  | { kind: 'object'; id: string }
  | { kind: 'opening'; id: string }
  | { kind: 'wall'; id: string }

export type Measured = 'all' | 'selected' | 'none'

export const MEASURED: Measured[] = ['none', 'selected', 'all']

type SelectionState = {
  selected: Selection | null
  measured: Measured
  select: (selection: Selection | null) => void
  measure: (measured: Measured) => void
}

export const selectionStore = createStore<SelectionState>()((set) => ({
  selected: null,
  measured: 'none',
  select: (selected) => set({ selected }),
  measure: (measured) => set({ measured }),
}))

export function useSelection<T>(selector: (state: SelectionState) => T): T {
  return useStore(selectionStore, selector)
}
