import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

/** The plan from above, or walked through at eye height. */
export type Mode = '2d' | '3d'

type ModeState = {
  mode: Mode
  setMode: (mode: Mode) => void
}

/**
 * Which way the plan is being looked at. The document is the same either way;
 * only the camera and what the hand can do differ. The plan is drawn from
 * above, and edited there; walked through, it is looked at and picked from.
 */
export const modeStore = createStore<ModeState>()((set) => ({
  mode: '2d',
  setMode: (mode) => set({ mode }),
}))

export function useMode<T>(selector: (state: ModeState) => T): T {
  return useStore(modeStore, selector)
}
