import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

/** What the pointer is over: a room, a thing, a door or window, or a wall. */
type Hovered =
  | { kind: 'room'; id: string }
  | { kind: 'object'; id: string }
  | { kind: 'opening'; id: string }
  | { kind: 'wall'; id: string }

type HoverState = {
  hovered: Hovered | null
  hover: (hovered: Hovered | null) => void
}

/**
 * Whatever is under the pointer goes a pale blue, so the hand knows what a
 * click would pick before it clicks. Like picking, this is a matter of the
 * sitting: nothing of it reaches the document.
 */
export const hoverStore = createStore<HoverState>()((set) => ({
  hovered: null,
  hover: (hovered) => set({ hovered }),
}))

export function useHover<T>(selector: (state: HoverState) => T): T {
  return useStore(hoverStore, selector)
}

/** The blues things go: picked, and merely under the pointer. */
export const EMPHASIS = {
  picked: { fill: '#8fb3ff', line: '#1e4fd8', glass: '#dbe7ff', tint: '#8fb3ff' },
  hovered: { fill: '#cfe0ff', line: '#5b8def', glass: '#eef4ff', tint: '#d6e4ff' },
} as const

export type Emphasis = keyof typeof EMPHASIS
