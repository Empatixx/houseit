import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

export type RailTab = 'plan' | 'issues' | 'view'

type ShellState = {
  panel: boolean
  rail: boolean
  tab: RailTab | null
  showPanel: (open: boolean) => void
  pullRail: (open: boolean) => void
  showTab: (tab: RailTab) => void
}

export const shellStore = createStore<ShellState>()((set) => ({
  panel: true,
  rail: false,
  tab: null,
  showPanel: (panel) => set({ panel }),
  pullRail: (rail) => set({ rail }),
  showTab: (tab) => set((state) => ({ tab: state.tab === tab ? null : tab })),
}))

export function useShell<T>(selector: (state: ShellState) => T): T {
  return useStore(shellStore, selector)
}
