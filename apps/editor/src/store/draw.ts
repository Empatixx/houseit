import type { Point } from '@houseit/geometry/outlines'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

type DrawState = {
  points: Point[]
  cursor: Point | null
  put: (point: Point) => void
  aim: (point: Point | null) => void
  clear: () => void
}

export const drawStore = createStore<DrawState>()((set) => ({
  points: [],
  cursor: null,
  put: (point) => set((state) => ({ points: [...state.points, point] })),
  aim: (cursor) => set({ cursor }),
  clear: () => set({ points: [], cursor: null }),
}))

export function useDraw<T>(selector: (state: DrawState) => T): T {
  return useStore(drawStore, selector)
}
