import type { Point } from '@houseit/geometry/outlines'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

type Walker = {
  at: Point
  yaw: number
  pitch: number
}

export const EYE = 1600

const NECK = 1.3

type WalkState = {
  walker: Walker | null
  fov: number
  place: (at: Point, yaw?: number) => void
  step: (at: Point) => void
  look: (yaw: number, pitch: number) => void
  setFov: (fov: number) => void
}

export const walkStore = createStore<WalkState>()((set) => ({
  walker: null,
  fov: 90,
  place: (at, yaw = 0) => set({ walker: { at, yaw, pitch: 0 } }),
  step: (at) => set((state) => (state.walker ? { walker: { ...state.walker, at } } : {})),
  look: (yaw, pitch) =>
    set((state) =>
      state.walker
        ? { walker: { ...state.walker, yaw, pitch: Math.max(-NECK, Math.min(NECK, pitch)) } }
        : {},
    ),
  setFov: (fov) => set({ fov }),
}))

export function useWalk<T>(selector: (state: WalkState) => T): T {
  return useStore(walkStore, selector)
}

export const headingOf = (yaw: number): Point => ({ x: Math.sin(yaw), y: Math.cos(yaw) })

export const yawTowards = (from: Point, to: Point): number =>
  Math.atan2(to.x - from.x, to.y - from.y)
