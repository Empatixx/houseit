/**
 * What a thing actually stands on, as more than one box where one will not do.
 *
 * Most furniture is a rectangle and one box is the whole truth of it. An
 * L-shaped kitchen is not: its box takes in the corner it wraps round, which is
 * the emptiest floor in the room and the obvious place for the chair the box
 * then refuses. A U-shaped run claims the whole galley you stand in.
 *
 * So a type may say what it fills, as boxes in its own frame — x across from
 * left to right, y from the back that goes against the wall to the front. They
 * were read off the symbols rather than guessed at: each was drawn onto a
 * sixteen-by-sixteen grid and the cells with ink in them written down.
 */

/** A part of a thing's footprint, in fractions of its own width and depth. */
export type Part = { x0: number; y0: number; x1: number; y1: number }

/** The whole of it, which is what almost everything is. */
const WHOLE: readonly Part[] = [{ x0: 0, y0: 0, x1: 1, y1: 1 }]

/** A run along the back and a leg down one side, which is what an L is. */
const ell = (back: number, leg: number): readonly Part[] => [
  { x0: 0, y0: 0, x1: 1, y1: back },
  { x0: 0, y0: 0, x1: leg, y1: 1 },
]

/** The same with the leg on the right, for a thing drawn the other way round. */
const ellRight = (back: number, leg: number): readonly Part[] => [
  { x0: 0, y0: 0, x1: 1, y1: back },
  { x0: 1 - leg, y0: 0, x1: 1, y1: 1 },
]

/** A run along the back and a leg down each side: the galley is the empty part. */
const horseshoe = (back: number, leg: number): readonly Part[] => [
  { x0: 0, y0: 0, x1: 1, y1: back },
  { x0: 0, y0: 0, x1: leg, y1: 1 },
  { x0: 1 - leg, y0: 0, x1: 1, y1: 1 },
]

/**
 * The types that are not the rectangle they are cut from.
 *
 * Anything not here fills its box, which is the ordinary case — a bed, a table,
 * a bath. A shape here is a shape whose box lies about where the floor is free.
 */
const SHAPED: Record<string, readonly Part[]> = {
  'kitchen-l': ell(0.32, 0.25),
  'kitchen-l-mini': ell(0.38, 0.32),
  'kitchen-l-mini-wall': ell(0.38, 0.32),
  'kitchen-u': horseshoe(0.25, 0.25),
  'kitchen-u-wall': horseshoe(0.25, 0.25),
  'counter-l': ell(0.56, 0.32),
  'office-desk-l': ell(0.38, 0.38),
  // Its chaise is on the right, which is the one thing the drawing insisted on.
  'sofa-l': ellRight(0.56, 0.32),
  // A flight turning a right angle: the corner it turns on and the two arms off
  // it. The inside of the corner is floor, and on a landing stair it is the
  // landing you stand on rather than anything to walk round.
  'stairs-l-landing': ell(0.35, 0.35),
  'stairs-l-winder': ell(0.35, 0.35),
}

/**
 * The boxes a type fills, in fractions of its own size.
 *
 * A U-shaped staircase is not here on purpose: its two flights and the landing
 * across their heads fill the whole rectangle, however much it looks like a U.
 */
export const partsOf = (type: string): readonly Part[] => SHAPED[type] ?? WHOLE
