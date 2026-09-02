import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

/** What the next click on the plan will put there, if anything. */
export type Armed =
  | { kind: 'object'; type: string }
  | { kind: 'door'; variant: 'hinged' | 'sliding' | 'pocket' | 'garage' }
  | { kind: 'window' }
  | { kind: 'wall' }

type ToolState = {
  armed: Armed | null
  arm: (armed: Armed | null) => void
}

/**
 * A thing picked from the palette waits here for a click on the plan. It is
 * not a mode the editor is in — nothing else changes — only what a click on a
 * room means until it has happened, or until Escape.
 */
export const toolStore = createStore<ToolState>()((set) => ({
  armed: null,
  arm: (armed) => set({ armed }),
}))

export function useTool<T>(selector: (state: ToolState) => T): T {
  return useStore(toolStore, selector)
}
