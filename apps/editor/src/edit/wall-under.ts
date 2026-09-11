import type { HouseDocument } from '@houseit/core/document'
import { boundaryWallsOf } from '@houseit/geometry/boundary'
import type { Point } from '@houseit/geometry/outlines'
import type { Room } from '@houseit/geometry/rooms'

const REACH = 100

export function wallUnder(
  doc: HouseDocument,
  level: string,
  room: Room,
  point: Point,
): string | undefined {
  let nearest: { id: string; away: number } | undefined
  for (const wall of boundaryWallsOf(doc, level, room)) {
    const a = doc.nodes[wall.a]
    const b = doc.nodes[wall.b]
    if (!a || !b) continue
    const span = Math.hypot(b.x - a.x, b.y - a.y)
    if (span === 0) continue
    const along = ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / (span * span)
    if (along < 0 || along > 1) continue
    const away = Math.abs(((point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x)) / span)
    if (away > wall.thickness / 2 + REACH) continue
    if (!nearest || away < nearest.away) nearest = { id: wall.id, away }
  }
  return nearest?.id
}
