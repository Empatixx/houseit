import type { Point } from '@houseit/geometry/outlines'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

type DrawState = {
  /** The corners put down so far, the first one first. Empty when nothing is being drawn. */
  points: Point[]
  /** Where the next corner would go, following the pointer: square to the last one. */
  cursor: Point | null
  put: (point: Point) => void
  aim: (point: Point | null) => void
  clear: () => void
}

/**
 * A wall being drawn: corners put down one click at a time, the line to the
 * next one following the pointer, always north, south, east or west. The
 * walls themselves are made when the drawing is finished, as one command.
 */
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
