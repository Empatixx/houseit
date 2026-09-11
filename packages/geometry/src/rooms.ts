import type { HouseDocument } from '@houseit/core/document'
import { type Face, findFaces } from '@houseit/core/faces'
import { areaInBox } from './area-in-box'
import { centroidOf } from './centroid'
import { clearAreaOf, clearOutline } from './clear'
import { shaftsOn } from './connections'

import type { Point } from './outlines'

export type Room = Face & {
  clear: number
  centre: Point
  id?: string
  name?: string
  floor?: string
  kind?: string
}

export function roomsOf(doc: HouseDocument, level: string): Room[] {
  const stored = Object.values(doc.rooms).filter((room) => room.level === level)

  return findFaces(doc, level).map((face) => {
    const polygon = face.nodes.map((id) => doc.nodes[id]!)
    const walls = new Set(face.walls)
    const found =
      stored.find(
        (candidate) =>
          candidate.loop.length === walls.size && candidate.loop.every((id) => walls.has(id)),
      ) ?? stored.find((candidate) => containsPoint(polygon, candidate.x, candidate.y))
    const room: Room = {
      ...face,
      clear:
        clearAreaOf(doc, level, face.nodes) -
        (doc.levels[level]?.columns ?? []).reduce(
          (sum, c) =>
            sum +
            areaInBox(clearOutline(doc, level, face.nodes), {
              x0: c.x - c.width / 2,
              x1: c.x + c.width / 2,
              y0: c.y - c.depth / 2,
              y1: c.y + c.depth / 2,
            }),
          0,
        ) -
        shaftsOn(doc, level)
          .filter((s) => s.enclosure && containsPoint(polygon, s.x, s.y))
          .reduce(
            (sum, s) =>
              sum + (s.width + 2 * s.enclosure!.thickness) * (s.depth + 2 * s.enclosure!.thickness),
            0,
          ),
      centre: centroidOf(polygon, face.area),
    }
    return found
      ? { ...room, id: found.id, name: found.name, floor: found.floor, kind: found.kind }
      : room
  })
}

export function containsPoint(polygon: { x: number; y: number }[], x: number, y: number): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]!
    const b = polygon[j]!
    const straddles = a.y > y !== b.y > y
    if (!straddles) continue
    const crossingX = a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y)
    if (x < crossingX) inside = !inside
  }
  return inside
}
