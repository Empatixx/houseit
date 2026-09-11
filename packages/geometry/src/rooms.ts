import type { HouseDocument } from '@houseit/core/document'
import { type Face, findFaces } from '@houseit/core/faces'
import { centroidOf } from './centroid'
import { clearAreaOf } from './clear'

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
        (doc.levels[level]?.columns ?? [])
          .filter((c) => containsPoint(polygon, c.x, c.y))
          .reduce((sum, c) => sum + c.width * c.depth, 0),
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
