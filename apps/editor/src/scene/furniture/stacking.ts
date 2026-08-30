import type { Layer } from '@houseit/core/object-types'
import type { Part } from './skeleton'

/** Clear of the floor beneath, and far under the walls, which draw over everything. */
const BASE = 30
/**
 * How far apart the layers of a room are drawn: what lies on the floor, what
 * stands on it, and what stands on that. Comfortably larger than any run of steps
 * inside one thing, so a layer always wins over a part.
 */
const LAYER = 200
const LAYERS: Record<Layer, number> = { under: 0, floor: LAYER, over: LAYER * 2 }
/** Between the parts of one thing: a table's top over the chairs tucked under it. */
export const STEP = 8

/**
 * How high a part is drawn in the plan, which is the only thing deciding what
 * covers what: the drawing is seen from straight overhead, so there is no order
 * to set, only height.
 *
 * Three rules, and each is there because of a way the drawing went wrong without
 * it. A thing is drawn in its own layer, or a table stands under the carpet and a
 * television behind the console it sits on. Parts of one thing are a clear step
 * apart, so a top always covers what it hides. And every object is nudged a hair
 * off its neighbours, because two shapes at exactly the same height do not pick a
 * winner — they flicker, differently on every machine.
 */
export function planHeight(part: Part, of: { layer: Layer; index: number }): number {
  return BASE + LAYERS[of.layer] + part.lift * STEP + nudge(of.index)
}

/** Small enough never to reach a step, so it can never reorder a thing's own parts. */
const nudge = (index: number) => ((index % 64) * STEP) / 128

/**
 * Where a thing's shadow falls, in plan millimetres.
 *
 * One way for everything, as a drawn shadow must be: light coming over the
 * reader's left shoulder, so every shadow slips right and down. Sunlight would be
 * more honest and would also turn with the compass, which is not what a plan is
 * for — a shadow here is only there to lift the furniture off the floor.
 */
export const SHADOW = { x: 55, y: -55 }

/**
 * Under the whole thing, not merely under the part that casts it.
 *
 * Cast just below its own part, a shadow lands on top of whatever is lower in the
 * same object — the seat's shadow falls across the arms and the sofa looks
 * bruised. One plane beneath the lot puts every shadow where a shadow goes.
 */
export const shadowHeight = (of: { layer: Layer; index: number }) =>
  BASE + LAYERS[of.layer] + nudge(of.index) - 4
