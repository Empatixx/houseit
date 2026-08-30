import type { HouseDocument } from '@houseit/core/document'
import { centroidOf } from './centroid'
import { type Face, findFaces } from './faces'

import type { Point } from './outlines'

export type Room = Face & {
  /** Where to hang the room's label, in millimetres. */
  centre: Point
  /** Name of the label anchored inside this room, if there is one. */
  name?: string
  labelId?: string
}

/**
 * Rooms are faces with their names attached. Because a face has no stable
 * identity — it is recomputed from the wall graph on every edit — a name is stored
 * as an anchor point and matched to whichever face now contains it. That is what
 * keeps the kitchen labelled as the kitchen after a partition moves.
 */
export function roomsOf(doc: HouseDocument, level: string): Room[] {
  const labels = Object.values(doc.roomLabels).filter((label) => label.level === level)

  return findFaces(doc, level).map((face) => {
    const polygon = face.nodes.map((id) => doc.nodes[id]!)
    const label = labels.find((candidate) => contains(polygon, candidate.x, candidate.y))
    const room: Room = { ...face, centre: centroidOf(polygon, face.area) }
    return label ? { ...room, name: label.name, labelId: label.id } : room
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
