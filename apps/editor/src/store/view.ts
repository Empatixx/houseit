import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

/** A box on the plan, in millimetres. */
export type ViewBox = { x0: number; y0: number; x1: number; y1: number }

type ViewState = {
  /** What to frame: a box, or nothing for the whole plan. */
  box: ViewBox | null
  /** Counts the asks, so asking for the same framing twice frames it twice. */
  asked: number
  frame: (box: ViewBox | null) => void
}

/**
 * What the camera has been asked to look at. The Fit button asks for the plan;
 * the agent, wanting a picture of one room, asks for that room. Neither is
 * part of the document — where the camera is has nothing to do with the plan.
 */
export const viewStore = createStore<ViewState>()((set) => ({
  box: null,
  asked: 0,
  frame: (box) => set((state) => ({ box, asked: state.asked + 1 })),
}))

export function useView<T>(selector: (state: ViewState) => T): T {
  return useStore(viewStore, selector)
}
