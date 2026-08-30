import type { Point } from './outlines'

/**
 * Area-weighted centroid. Rounded to whole millimetres like every other length,
 * and derived from the same shoelace terms as the area itself.
 */
export function centroidOf(polygon: Point[], area: number): Point {
  let x = 0
  let y = 0
  for (let i = 0; i < polygon.length; i += 1) {
    const current = polygon[i]!
    const next = polygon[(i + 1) % polygon.length]!
    const cross = current.x * next.y - next.x * current.y
    x += (current.x + next.x) * cross
    y += (current.y + next.y) * cross
  }
  const scale = 6 * area
  return { x: Math.round(x / scale), y: Math.round(y / scale) }
}
