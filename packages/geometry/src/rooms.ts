import type { HouseDocument } from '@houseit/core/document'
import { centroidOf } from './centroid'
import { type Face, findFaces } from './faces'

import type { Point } from './outlines'

export type Room = Face & {
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
    const found = stored.find((candidate) => containsPoint(polygon, candidate.x, candidate.y))
    const room: Room = { ...face, centre: centroidOf(polygon, face.area) }
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
