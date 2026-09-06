import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

export type ViewBox = { x0: number; y0: number; x1: number; y1: number }

export type Edge = 'top' | 'right' | 'bottom' | 'left'

export type Cover = { edge: Edge; extent: number }

export type Clear = { x: number; y: number; width: number; height: number }

type ViewState = {
  box: ViewBox | null
  asked: number
  frame: (box: ViewBox | null) => void
  step: number
  factor: number
  zoomBy: (factor: number) => void
  spin: number
  spinTo: (spin: number) => void
  covers: Record<string, Cover>
  cover: (id: string, cover: Cover | null) => void
}

export const viewStore = createStore<ViewState>()((set) => ({
  box: null,
  asked: 0,
  frame: (box) => set((state) => ({ box, asked: state.asked + 1 })),
  step: 0,
  factor: 1,
  zoomBy: (factor) => set((state) => ({ step: state.step + 1, factor })),
  spin: 0,
  spinTo: (spin) => set({ spin: ((spin % 360) + 360) % 360 }),
  covers: {},
  cover: (id, cover) =>
    set((state) => {
      const covers = { ...state.covers }
      if (cover) covers[id] = cover
      else delete covers[id]
      return { covers }
    }),
}))

export function useView<T>(selector: (state: ViewState) => T): T {
  return useStore(viewStore, selector)
}

export function clearOf(
  covers: Record<string, Cover>,
  size: { width: number; height: number },
): Clear {
  const reach = (edge: Edge) =>
    Math.max(
      0,
      ...Object.values(covers)
        .filter((cover) => cover.edge === edge)
        .map((cover) => cover.extent),
    )
  const x = reach('left')
  const y = reach('top')
  return {
    x,
    y,
    width: Math.max(1, size.width - x - reach('right')),
    height: Math.max(1, size.height - y - reach('bottom')),
  }
}
