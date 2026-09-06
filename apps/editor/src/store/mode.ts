import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

export type Mode = '2d' | '3d'

type ModeState = {
  mode: Mode
  setMode: (mode: Mode) => void
}

export const modeStore = createStore<ModeState>()((set) => ({
  mode: '2d',
  setMode: (mode) => set({ mode }),
}))

export function useMode<T>(selector: (state: ModeState) => T): T {
  return useStore(modeStore, selector)
}
