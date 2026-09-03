import type { Point } from '@houseit/geometry/outlines'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

/** Somebody standing in the plan: where, which way they face, and how far up or down they look. */
export type Walker = {
  /** Where they stand, in plan millimetres. */
  at: Point
  /** Which way they face, in radians clockwise from north. */
  yaw: number
  /** How far they look up (positive) or down, in radians. */
  pitch: number
}

/** Eye height above the floor, in millimetres. */
export const EYE = 1600

/** How far up or down the head turns before the neck says no. */
const NECK = 1.3

type WalkState = {
  /** Nobody, until the walk has started. */
  walker: Walker | null
  /** How wide the view is, side to side, in degrees: what the minimap draws as the wedge. */
  fov: number
  place: (at: Point, yaw?: number) => void
  step: (at: Point) => void
  look: (yaw: number, pitch: number) => void
  setFov: (fov: number) => void
}

/**
 * Where the walk has got to. Kept apart from the camera so the minimap can
 * draw it and a click on the minimap can move it, and kept across switches
 * back to the plan so coming back to the walk picks up where it left off.
 */
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

/** The way somebody facing `yaw` is looking, as a unit vector on the plan. */
export const headingOf = (yaw: number): Point => ({ x: Math.sin(yaw), y: Math.cos(yaw) })

/** The yaw that faces from one point towards another. */
export const yawTowards = (from: Point, to: Point): number =>
  Math.atan2(to.x - from.x, to.y - from.y)
