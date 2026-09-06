import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

export type Armed =
  | { kind: 'object'; type: string }
  | { kind: 'door'; variant: 'hinged' | 'sliding' | 'pocket' | 'garage' }
  | { kind: 'window' }
  | { kind: 'wall' }

type ToolState = {
  armed: Armed | null
  arm: (armed: Armed | null) => void
}

export const toolStore = createStore<ToolState>()((set) => ({
  armed: null,
  arm: (armed) => set({ armed }),
}))

export function useTool<T>(selector: (state: ToolState) => T): T {
  return useStore(toolStore, selector)
}
