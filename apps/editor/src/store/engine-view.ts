import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

export type EngineTool = 'select' | 'length' | 'edge'
export type EngineView = '3d' | 'plan' | 'section-x' | 'section-y'

type EngineViewState = {
  view: EngineView
  tool: EngineTool
  snap: boolean
  cutHeight: number
  sectionOffset: number
  busy: boolean
  error: string | null
  clearRequested: number
  setView: (view: EngineView) => void
  setTool: (tool: EngineTool) => void
  setSnap: (snap: boolean) => void
  setCutHeight: (height: number) => void
  setSectionOffset: (offset: number) => void
  clear: () => void
}

export const engineViewStore = createStore<EngineViewState>()((set) => ({
  view: 'plan',
  tool: 'select',
  snap: true,
  cutHeight: 1.2,
  sectionOffset: 0,
  busy: true,
  error: null,
  clearRequested: 0,
  setView: (view) => set({ view }),
  setTool: (tool) => set({ tool }),
  setSnap: (snap) => set({ snap }),
  setCutHeight: (cutHeight) => set({ cutHeight }),
  setSectionOffset: (sectionOffset) => set({ sectionOffset }),
  clear: () => set((state) => ({ clearRequested: state.clearRequested + 1 })),
}))

export function useEngineView<T>(selector: (state: EngineViewState) => T) {
  return useStore(engineViewStore, selector)
}
