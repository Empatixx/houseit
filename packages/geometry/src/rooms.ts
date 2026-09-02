import type { HouseDocument } from '@houseit/core/document'
import { centroidOf } from './centroid'
import { type Face, findFaces } from './faces'

import type { Point } from './outlines'

export type Room = Face & {
  /** Where to hang the room's label, in millimetres. */
  centre: Point
  /** The stored room this face belongs to, if any is anchored inside it. */
  id?: string
  name?: string
  /** Id from the floor material catalogue, off the stored room. */
  floor?: string
  /** What sort of room it was told it is, off the stored room. */
  kind?: string
}

/**
 * Faces of the wall graph with their stored rooms attached.
 *
 * A face has no lasting identity — it is recomputed on every edit — so the room
 * record is matched to it by the anchor point the record carries. That is what
 * keeps the kitchen the kitchen, with its own floor, after a partition moves.
 */
export function roomsOf(doc: HouseDocument, level: string): Room[] {
  const stored = Object.values(doc.rooms).filter((room) => room.level === level)

  return findFaces(doc, level).map((face) => {
    const polygon = face.nodes.map((id) => doc.nodes[id]!)
    const found = stored.find((candidate) => contains(polygon, candidate.x, candidate.y))
    const room: Room = { ...face, centre: centroidOf(polygon, face.area) }
    return found
      ? { ...room, id: found.id, name: found.name, floor: found.floor, kind: found.kind }
      : room
  })
}

/**
 * Ray casting, counting crossings of a ray heading in +x. Written out rather than
 * taken from a geometry library because a face may repeat a vertex where a wall
 * dangles into the room, which is not a simple polygon.
 */
function contains(polygon: { x: number; y: number }[], x: number, y: number): boolean {
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
