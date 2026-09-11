import type { Box } from './boxes'
import type { Point } from './outlines'

// Clip by a convex box; signed area also sums disconnected portions of an orthogonal room.
export function areaInBox(outline: Point[], box: Box): number {
  let polygon = outline
  for (const [axis, limit, sign] of [
    ['x', box.x0, 1],
    ['x', box.x1, -1],
    ['y', box.y0, 1],
    ['y', box.y1, -1],
  ] as const) {
    const next: Point[] = []
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i]!,
        b = polygon[(i + 1) % polygon.length]!
      const da = (a[axis] - limit) * sign,
        db = (b[axis] - limit) * sign
      if (da >= 0) next.push(a)
      if (da >= 0 !== db >= 0) {
        const t = da / (da - db)
        next.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) })
      }
    }
    polygon = next
  }
  return Math.abs(
    polygon.reduce((sum, p, i) => {
      const q = polygon[(i + 1) % polygon.length]!
      return sum + p.x * q.y - q.x * p.y
    }, 0) / 2,
  )
}
