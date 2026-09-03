import type { HouseDocument } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import { roomsOf } from '@houseit/geometry/rooms'

/**
 * Where a walk starts: in the biggest room, where its record is anchored —
 * which is always inside it, however it bends — facing north. Nowhere while
 * there are no rooms.
 */
export function startOf(doc: HouseDocument, level: string): Point | undefined {
  const rooms = roomsOf(doc, level)
  if (rooms.length === 0) return undefined
  const biggest = rooms.reduce((best, next) => (next.area > best.area ? next : best))
  const stored = biggest.id ? doc.rooms[biggest.id] : undefined
  return stored ? { x: stored.x, y: stored.y } : biggest.centre
}
