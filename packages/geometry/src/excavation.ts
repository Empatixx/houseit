import type { HouseDocument } from '@houseit/core/document'
import { type Box, boxOf } from './boxes'
import { rampOutline } from './connections'
import { exteriorSides } from './exterior'
import type { Point } from './outlines'
import { containsPoint } from './rooms'
import { unionOfBoxes } from './union'

export function excavations(doc: HouseDocument): Point[][] {
  const boxes: Box[] = []
  for (const level of Object.values(doc.levels).filter((l) => l.elevation < 0)) {
    const outside = exteriorSides(doc, level.id)
    const edges = [...outside].map(([id, side]) => {
      const w = doc.walls[id]!
      return { from: side === -1 ? w.a : w.b, to: side === -1 ? w.b : w.a }
    })
    const visited = new Set<string>()
    const outlines: Point[][] = []
    for (const start of edges) {
      if (visited.has(start.from)) continue
      let edge = start
      const ring: Point[] = []
      while (!visited.has(edge.from)) {
        visited.add(edge.from)
        ring.push(doc.nodes[edge.from]!)
        const next = edges.find((e) => e.from === edge.to)
        if (!next) break
        edge = next
      }
      if (ring.length >= 3) outlines.push(ring)
    }
    for (const polygon of outlines) {
      const xs = [...new Set(polygon.map((p) => p.x))].sort((a, b) => a - b)
      const ys = [...new Set(polygon.map((p) => p.y))].sort((a, b) => a - b)
      for (let x = 1; x < xs.length; x++)
        for (let y = 1; y < ys.length; y++) {
          if (containsPoint(polygon, (xs[x - 1]! + xs[x]!) / 2, (ys[y - 1]! + ys[y]!) / 2))
            boxes.push({ x0: xs[x - 1]!, x1: xs[x]!, y0: ys[y - 1]!, y1: ys[y]! })
        }
    }
    boxes.push(...(level.ramps ?? []).map((r) => boxOf(rampOutline(r))))
  }
  return unionOfBoxes(boxes)
}
