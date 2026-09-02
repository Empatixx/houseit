import { centroidOf } from './centroid'
import type { Point } from './outlines'
import { containsPoint } from './rooms'

/**
 * A point inside a polygon to hang a room's record on.
 *
 * The centroid, when it is inside — and for a U or a deep L it is not: the
 * middle of a horseshoe is the gap. Then a point just in from the middle of
 * one of its edges is taken instead, the room being on the left of every edge
 * of a counter-clockwise face. Any point inside will do; it only has to stay
 * inside, and near the middle of an edge is as far from the far walls as a
 * point can be sure to be.
 */
export function anchorInside(polygon: Point[], area: number, step = 200): Point {
  const centre = centroidOf(polygon, area)
  const rounded = { x: Math.round(centre.x), y: Math.round(centre.y) }
  if (containsPoint(polygon, rounded.x, rounded.y)) return rounded

  const count = polygon.length
  for (let i = 0; i < count; i += 1) {
    const a = polygon[i]!
    const b = polygon[(i + 1) % count]!
    const span = Math.hypot(b.x - a.x, b.y - a.y)
    if (span === 0) continue
    const inward = { x: -(b.y - a.y) / span, y: (b.x - a.x) / span }
    const probe = {
      x: Math.round((a.x + b.x) / 2 + inward.x * step),
      y: Math.round((a.y + b.y) / 2 + inward.y * step),
    }
    if (containsPoint(polygon, probe.x, probe.y)) return probe
  }
  return rounded
}
