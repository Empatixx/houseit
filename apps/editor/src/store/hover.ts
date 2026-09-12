import { createStore } from 'zustand/vanilla'

type Hovered =
  | { kind: 'room'; id: string }
  | { kind: 'object'; id: string }
  | { kind: 'opening'; id: string }
  | { kind: 'wall'; id: string }

type HoverState = {
  hovered: Hovered | null
  hover: (hovered: Hovered | null) => void
}

export const hoverStore = createStore<HoverState>()((set) => ({
  hovered: null,
  hover: (hovered) => set({ hovered }),
}))
