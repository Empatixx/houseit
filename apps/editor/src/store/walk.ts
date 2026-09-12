import type { Point } from '@houseit/geometry/outlines'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

type Walker = {
  height?: number
  at: Point
  yaw: number
  pitch: number
}

export const EYE = 1600

const NECK = 1.3

type Inspection = {
  at: [number, number, number]
  target: [number, number, number]
  span: number
  orthographic: boolean
  site?: boolean
}

type WalkState = {
  movement: 'free' | 'walk'
  setMovement: (movement: 'free' | 'walk') => void
  explore: () => void
  inspection: Inspection | null
  inspect: (view: Inspection | null) => void
  walker: Walker | null
  fov: number
  place: (at: Point, yaw?: number) => void
  step: (at: Point, height?: number) => void
  look: (yaw: number, pitch: number) => void
  setFov: (fov: number) => void
}

export const walkStore = createStore<WalkState>()((set) => ({
  movement: 'free',
  setMovement: (movement) => set({ movement }),
  explore: () =>
    set((state) => {
      const view = state.inspection
      if (!view) return {}
      const dx = view.target[0] - view.at[0]
      const dy = view.target[1] - view.at[1]
      const dz = view.target[2] - view.at[2]
      return {
        inspection: null,
        movement: 'free',
        walker: {
          at: { x: view.at[0] * 1000, y: -view.at[2] * 1000 },
          height: view.at[1] * 1000 - EYE,
          yaw: Math.atan2(dx, -dz),
          pitch: Math.atan2(dy, Math.hypot(dx, dz)),
        },
      }
    }),
  walker: null,
  inspection: null,
  inspect: (inspection) => set({ inspection }),
  fov: 90,
  place: (at, yaw = 0) => set({ inspection: null, walker: { at, yaw, pitch: 0 } }),
  step: (at, height) =>
    set((state) => (state.walker ? { walker: { ...state.walker, at, height } } : {})),
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
