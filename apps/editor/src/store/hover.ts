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
 * Whatever is under the pointer goes a pale violet, so the hand knows what a
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

/** The violets things go: picked, and merely under the pointer. */
export const EMPHASIS = {
  picked: { fill: '#b9a4ea', line: '#5a35a8', glass: '#e8e0ff', tint: '#b9a4ea' },
  hovered: { fill: '#ddd2f6', line: '#a98fe0', glass: '#f3eefc', tint: '#e4dbf8' },
} as const

export type Emphasis = keyof typeof EMPHASIS
