import type { Point } from '@houseit/geometry/outlines'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

export type Guide = { from: Point; to: Point }

type DrawState = {
  points: Point[]
  cursor: Point | null
  guides: Guide[]
  typed: string
  put: (point: Point) => void
  aim: (point: Point | null, guides?: Guide[]) => void
  type: (typed: string) => void
  clear: () => void
}

export const drawStore = createStore<DrawState>()((set) => ({
  points: [],
  cursor: null,
  guides: [],
  typed: '',
  put: (point) => set((state) => ({ points: [...state.points, point], typed: '' })),
  aim: (cursor, guides = []) => set({ cursor, guides }),
  type: (typed) => set({ typed }),
  clear: () => set({ points: [], cursor: null, guides: [], typed: '' }),
}))

export function useDraw<T>(selector: (state: DrawState) => T): T {
  return useStore(drawStore, selector)
}
