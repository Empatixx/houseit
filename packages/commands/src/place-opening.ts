import type { HouseDocument } from '@houseit/core/document'
import { boundaryWallsOf } from '@houseit/geometry/boundary'
import type { Room } from '@houseit/geometry/rooms'
import { freeSpans, spanAround, widestSpan } from '@houseit/geometry/spans'
import { CommandError } from './command-error'

export type Side = 'north' | 'south' | 'east' | 'west'

/** The coordinate a wall on that side holds constant, and which end of it to take. */
const SIDES = {
  west: { axis: 'x', low: true },
  east: { axis: 'x', low: false },
  south: { axis: 'y', low: true },
  north: { axis: 'y', low: false },
} as const satisfies Record<Side, { axis: 'x' | 'y'; low: boolean }>

export type Placement = {
  wall: string
  /** Along the wall, 0 at end `a` and 1 at end `b`. */
  t: number
  /**
   * Which side of the wall the room lies on, as a sign across it. A door swings
   * into the room it was named from, so this is what decides which way it opens.
   */
  swing: -1 | 1
}

/**
 * Where an opening of a given width goes in the wall on one side of a room.
 *
 * Nothing here takes a position: you know the bedroom looks south, not that its
 * window starts 2.4 m from the corner. So the position is chosen — the middle of
 * the widest stretch of that wall still free. One opening centres itself and a
 * second falls beside it, without either command naming a place.
 */
export function placeOpening(
  doc: HouseDocument,
  level: string,
  room: Room,
  side: Side,
  width: number,
  what: string,
): Placement {
  const { axis, low } = SIDES[side]
  const walls = boundaryWallsOf(doc, level, room)
    .map((wall) => ({ wall, a: doc.nodes[wall.a]!, b: doc.nodes[wall.b]! }))
    .filter(({ a, b }) => a && b && a[axis] === b[axis])

  if (walls.length === 0) {
    throw new CommandError(`${what}: ${room.name} has no wall facing ${side}`)
  }

  const offsets = walls.map(({ a }) => a[axis])
  const outermost = low ? Math.min(...offsets) : Math.max(...offsets)
  const chosen = walls
    .filter(({ a }) => a[axis] === outermost)
    .reduce((best, next) => (spanOf(next) > spanOf(best) ? next : best))

  const span = spanOf(chosen)
  if (width > span) {
    throw new CommandError(
      `${what}: ${width} mm does not fit the ${span} mm wall on the ${side} side of ${room.name}`,
    )
  }

  const taken = Object.values(doc.openings)
    .filter((opening) => opening.wall === chosen.wall.id)
    .map((opening) => spanAround(opening.t * span, opening.width))
  const gap = widestSpan(freeSpans(span, taken))

  if (!gap || gap.to - gap.from < width) {
    throw new CommandError(
      `${what}: ${width} mm does not fit beside the openings already in the ${side} wall of ${room.name}`,
    )
  }

  return {
    wall: chosen.wall.id,
    t: (gap.from + gap.to) / 2 / span,
    swing: sideOfWall(chosen.a, chosen.b, room.centre),
  }
}

const spanOf = ({ a, b }: { a: { x: number; y: number }; b: { x: number; y: number } }) =>
  Math.round(Math.hypot(b.x - a.x, b.y - a.y))

/**
 * Which side of the wall a point lies on, positive being a quarter turn
 * counter-clockwise from the wall's own direction.
 */
function sideOfWall(
  a: { x: number; y: number },
  b: { x: number; y: number },
  point: { x: number; y: number },
): -1 | 1 {
  const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x)
  return cross < 0 ? -1 : 1
}
