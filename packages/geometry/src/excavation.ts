import type { HouseDocument } from '@houseit/core/document'
import { roomKindOf } from '@houseit/core/room-kinds'
import { type Box, boxOf } from './boxes'
import { rampOutline } from './connections'
import { exteriorSides } from './exterior'
import type { Point } from './outlines'
import { containsPoint, roomsOf } from './rooms'
import { unionOfBoxes } from './union'

export function excavations(doc: HouseDocument): Point[][] {
  const boxes: Box[] = []
  if (doc.site?.surfaces.length) boxes.push(doc.site.groundCutout)
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
  for (const level of Object.values(doc.levels).filter((l) => l.elevation <= 0))
    for (const room of roomsOf(doc, level.id).filter((r) => roomKindOf(r)?.id === 'pond'))
      boxes.push(...gridded(room.nodes.map((id) => doc.nodes[id]!)))
  return unionOfBoxes(boxes)
}

function gridded(polygon: Point[]): Box[] {
  const xs = [...new Set(polygon.map((p) => p.x))].sort((a, b) => a - b)
  const ys = [...new Set(polygon.map((p) => p.y))].sort((a, b) => a - b)
  const boxes: Box[] = []
  for (let x = 1; x < xs.length; x++)
    for (let y = 1; y < ys.length; y++)
      if (containsPoint(polygon, (xs[x - 1]! + xs[x]!) / 2, (ys[y - 1]! + ys[y]!) / 2))
        boxes.push({ x0: xs[x - 1]!, x1: xs[x]!, y0: ys[y - 1]!, y1: ys[y]! })
  return boxes
}
