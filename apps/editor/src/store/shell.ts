import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

/** What the rail down the right edge shows when it is pulled out. */
export type RailTab = 'rooms' | 'issues' | 'catalogue'

type ShellState = {
  /** Whether the panel is wanted out; it shows only while there is something to show. */
  panel: boolean
  /** Whether the rail is pulled out to its full width, or folded to its icons. */
  rail: boolean
  /** Which of the rail's tabs is the current one. */
  tab: RailTab
  showPanel: (open: boolean) => void
  pullRail: (open: boolean) => void
  showTab: (tab: RailTab) => void
}

/**
 * What floats over the plan and how far it is out. None of it is part of the
 * document, and none of it is undone: folding the panel away is a matter of
 * the sitting, like what is picked.
 */
export const shellStore = createStore<ShellState>()((set) => ({
  panel: true,
  rail: false,
  tab: 'rooms',
  showPanel: (panel) => set({ panel }),
  pullRail: (rail) => set({ rail }),
  showTab: (tab) => set({ tab }),
}))

export function useShell<T>(selector: (state: ShellState) => T): T {
  return useStore(shellStore, selector)
}
