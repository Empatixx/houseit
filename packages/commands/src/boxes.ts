import type { Point } from '@houseit/geometry/outlines'

/**
 * A box round something, in plan millimetres.
 *
 * Everything the commands have to keep apart is drawn square to the plan — walls,
 * furniture, the quarter a door sweeps — so a box is all the shape needed to ask
 * whether two of them are in the same place. It is the generous answer of the
 * two, which is the one worth giving here: furniture that only just misses is
 * furniture somebody has to squeeze past.
 */
export type Box = { x0: number; y0: number; x1: number; y1: number }

export const boxOf = (points: Point[]): Box => ({
  x0: Math.min(...points.map((point) => point.x)),
  y0: Math.min(...points.map((point) => point.y)),
  x1: Math.max(...points.map((point) => point.x)),
  y1: Math.max(...points.map((point) => point.y)),
})

/** Touching is not banging into. Anything under this is a rounding artefact. */
const SLACK = 60

export const clashes = (one: Box, other: Box, slack = SLACK) =>
  one.x0 + slack < other.x1 &&
  other.x0 + slack < one.x1 &&
  one.y0 + slack < other.y1 &&
  other.y0 + slack < one.y1

/**
 * The box a wall fills: its centre line, out to its faces either side.
 *
 * Walls get one too. A room is drawn on the centre lines of the walls round it,
 * so a thing checked against the room alone can fit the room and still be
 * standing in half a wall — which is what the bedside table did, and what a
 * turned armchair does the moment it reaches further than it was cut to.
 */
export const wallBox = (a: Point, b: Point, thickness: number): Box => {
  const half = thickness / 2
  const along = Math.hypot(b.x - a.x, b.y - a.y) || 1
  const out = { x: (-(b.y - a.y) / along) * half, y: ((b.x - a.x) / along) * half }

  return boxOf([
    { x: a.x + out.x, y: a.y + out.y },
    { x: a.x - out.x, y: a.y - out.y },
    { x: b.x + out.x, y: b.y + out.y },
    { x: b.x - out.x, y: b.y - out.y },
  ])
}

/** How far into a wall a thing may reach before it is in the masonry, not at it. */
export const INSIDE_A_WALL = 20
