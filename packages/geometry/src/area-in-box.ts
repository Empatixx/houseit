import type { Box } from './boxes'
import type { Point } from './outlines'

export function disjointBoxes(boxes: Box[]): Box[] {
  const result: Box[] = []
  for (const box of boxes) {
    let pieces = [box]
    for (const used of result) {
      pieces = pieces.flatMap((p) => {
        const x0 = Math.max(p.x0, used.x0),
          x1 = Math.min(p.x1, used.x1)
        const y0 = Math.max(p.y0, used.y0),
          y1 = Math.min(p.y1, used.y1)
        if (x0 >= x1 || y0 >= y1) return [p]
        return [
          { ...p, x1: x0 },
          { ...p, x0: x1 },
          { x0, x1, y0: p.y0, y1: y0 },
          { x0, x1, y0: y1, y1: p.y1 },
        ].filter((b) => b.x0 < b.x1 && b.y0 < b.y1)
      })
      if (!pieces.length) break
    }
    result.push(...pieces)
  }
  return result
}

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
