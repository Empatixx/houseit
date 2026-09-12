import type { Layer } from '@houseit/core/object-types'

const BASE = 30
const LAYER = 200
const LAYERS: Record<Layer, number> = { under: 0, floor: LAYER, over: LAYER * 2 }

const nudge = (index: number) => (index % 64) / 16

export const symbolHeight = (of: { layer: Layer; index: number }) =>
  BASE + LAYERS[of.layer] + nudge(of.index)
