import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { Shot } from '../scene/walk/shots'

type TourState = {
  shots: Shot[]
  index: number
  held: boolean
  recording: boolean
  film: Blob | null
  play: (shots: Shot[], recording?: boolean) => void
  hold: (shots: Shot[], index: number) => void
  next: () => void
  stop: () => void
  keep: (film: Blob) => void
}

export const tourStore = createStore<TourState>()((set) => ({
  shots: [],
  index: 0,
  held: false,
  recording: false,
  film: null,
  play: (shots, recording = false) => set({ shots, index: 0, held: false, recording, film: null }),
  hold: (shots, index) => set({ shots, index, held: true, recording: false }),
  next: () =>
    set((state) =>
      state.index + 1 < state.shots.length
        ? { index: state.index + 1 }
        : { shots: [], index: 0, recording: false },
    ),
  stop: () => set({ shots: [], index: 0, held: false, recording: false }),
  keep: (film) => set({ film }),
}))

export function useTour<T>(selector: (state: TourState) => T): T {
  return useStore(tourStore, selector)
}
