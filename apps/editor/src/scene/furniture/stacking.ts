import type { Layer } from '@houseit/core/object-types'

/** Clear of the floor beneath, and far under the walls, which draw over everything. */
const BASE = 30
/**
 * How far apart the layers of a room are drawn: what lies on the floor, what
 * stands on it, and what stands on that. A layer always wins over anything in
 * the layer below it.
 */
const LAYER = 200
const LAYERS: Record<Layer, number> = { under: 0, floor: LAYER, over: LAYER * 2 }

/**
 * Every object is nudged a hair off its neighbours, because two pictures at
 * exactly the same height do not pick a winner — they flicker, differently on
 * every machine. Small enough never to reach the next layer.
 */
const nudge = (index: number) => (index % 64) / 16

/**
 * How high a thing is drawn in the plan, which is the only thing deciding what
 * covers what: the drawing is seen from straight overhead, so there is no order
 * to set, only height. A rug lies under the table on it; a lamp stands on the
 * table under it.
 */
export const symbolHeight = (of: { layer: Layer; index: number }) =>
  BASE + LAYERS[of.layer] + nudge(of.index)
