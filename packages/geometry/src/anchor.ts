import { centroidOf } from './centroid'
import type { Point } from './outlines'
import { containsPoint } from './rooms'

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
