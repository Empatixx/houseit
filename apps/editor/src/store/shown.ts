import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

export type Layer = 'grid' | 'below' | 'floors' | 'furniture' | 'labels'

export const LAYERS: { id: Layer; label: string; note: string }[] = [
  { id: 'floors', label: 'Floors', note: 'The material laid in each room' },
  { id: 'furniture', label: 'Furniture', note: 'Everything standing in the rooms' },
  { id: 'labels', label: 'Room names', note: 'The name and area written on each floor' },
  { id: 'below', label: 'Storey below', note: 'The floor under this one, showing through' },
  { id: 'grid', label: 'Grid', note: 'The dots behind the plan' },
]

type ShownState = {
  shown: Record<Layer, boolean>
  show: (layer: Layer, on: boolean) => void
  showAll: () => void
}

const all = (): Record<Layer, boolean> =>
  Object.fromEntries(LAYERS.map((layer) => [layer.id, true])) as Record<Layer, boolean>

export const shownStore = createStore<ShownState>()((set) => ({
  shown: all(),
  show: (layer, on) => set((state) => ({ shown: { ...state.shown, [layer]: on } })),
  showAll: () => set({ shown: all() }),
}))

export function useShown<T>(selector: (state: ShownState) => T): T {
  return useStore(shownStore, selector)
}
