import type { HouseDocument } from '@houseit/core/document'
import { openingsIn } from '@houseit/core/opening-parts'
import { flightWidthOf, stairKind, stairShape, treadsOf } from '@houseit/core/stairs'
import { rampDirection, rampHeights, shaftOutside, shaftsOn } from './connections'
import type { Point } from './outlines'
import { containsPoint, roomsOf } from './rooms'
import { stairRise } from './stair-runs'
import { onPlan, standingAt } from './standing'
import { wellsInRoom } from './wells'

export const WALK_RADIUS = 180

export function walkClear(doc: HouseDocument, level: string, at: Point): boolean {
  for (const s of shaftsOn(doc, level).filter((s) => s.enclosure)) {
    const corners = shaftOutside(s)
    if (
      at.x > corners[0]!.x - WALK_RADIUS &&
      at.x < corners[2]!.x + WALK_RADIUS &&
      at.y > corners[0]!.y - WALK_RADIUS &&
      at.y < corners[2]!.y + WALK_RADIUS
    )
      return false
  }
  for (const column of doc.levels[level]?.columns ?? []) {
    if (
      Math.abs(at.x - column.x) < column.width / 2 + WALK_RADIUS &&
      Math.abs(at.y - column.y) < column.depth / 2 + WALK_RADIUS
    )
      return false
  }
  for (const wall of Object.values(doc.walls)) {
    if (wall.level !== level) continue
    const a = doc.nodes[wall.a]!
    const b = doc.nodes[wall.b]!
    const dx = b.x - a.x,
      dy = b.y - a.y,
      length = Math.hypot(dx, dy)
    if (!length) continue
    const along = ((at.x - a.x) * dx + (at.y - a.y) * dy) / length
    const aside = Math.abs(((at.x - a.x) * dy - (at.y - a.y) * dx) / length)
    const thick =
      wall.thickness / 2 +
      WALK_RADIUS +
      (wall.exterior?.layers.reduce((n, l) => n + l.thickness, 0) ?? 0)
    if (aside >= thick || along < -WALK_RADIUS || along > length + WALK_RADIUS) continue
    const door = openingsIn(doc).some(
      (o) =>
        o.wall === wall.id &&
        o.kind === 'door' &&
        o.sillHeight === 0 &&
        o.height >= 1800 &&
        Math.abs(along - o.t * length) < o.width / 2 - WALK_RADIUS,
    )
    if (!door) return false
  }
  return true
}

export function walkSurface(
  doc: HouseDocument,
  at: Point,
  previous: number,
): { height: number; level: string } | undefined {
  for (const base of Object.values(doc.levels)) {
    for (const stair of base.stairs ?? []) {
      const riser = stairRise(doc, base.id, stair)
      for (const tread of treadsOf(stair)) {
        const height = base.elevation + stair.baseOffset + tread.step * riser
        if (Math.abs(height - previous) <= 220 && containsPoint(tread.outline, at.x, at.y))
          return { height, level: base.id }
      }
    }
    for (const ramp of base.ramps ?? []) {
      const direction = rampDirection(ramp)
      const dx = at.x - ramp.x,
        dy = at.y - ramp.y
      const along = dx * direction.x + dy * direction.y
      const aside = -dx * direction.y + dy * direction.x
      const heights = rampHeights(doc, base.id, ramp)
      if (
        !heights ||
        along < 0 ||
        along > ramp.length ||
        Math.abs(aside) > ramp.width / 2 - WALK_RADIUS
      )
        continue
      const height = heights.bottom + (along / ramp.length) * heights.rise
      if (Math.abs(height - previous) <= 220) return { height, level: base.id }
    }
    for (const object of Object.values(doc.objects).filter((o) => o.level === base.id)) {
      const kind = stairKind(object.type)
      if (!kind) continue
      const room = roomsOf(doc, base.id).find((r) => r.id === object.room)
      const spot = room && standingAt(doc, base.id, room, object)
      if (!spot) continue
      const shape = stairShape(kind, base.height, flightWidthOf(kind, object.width, base.height))
      for (const tread of treadsOf(shape)) {
        const polygon = tread.outline.map((p) => onPlan(spot, object, p))
        const height = base.elevation + tread.step * shape.riser
        if (Math.abs(height - previous) <= 220 && containsPoint(polygon, at.x, at.y))
          return { height, level: base.id }
      }
    }
  }
  const levels = Object.values(doc.levels).sort(
    (a, b) => Math.abs(a.elevation - previous) - Math.abs(b.elevation - previous),
  )
  let inside = false
  for (const level of levels) {
    const room = roomsOf(doc, level.id).find((r) =>
      containsPoint(
        r.nodes.map((id) => doc.nodes[id]!),
        at.x,
        at.y,
      ),
    )
    if (!room) continue
    inside = true
    if (Math.abs(level.elevation - previous) > 220) continue
    if (wellsInRoom(doc, level.id, room).some((w) => containsPoint(w.outline, at.x, at.y))) continue
    return { height: level.elevation, level: level.id }
  }
  if (!inside && Math.abs(previous) <= 220) {
    const ground = levels.find((l) => l.elevation === 0)
    if (ground) return { height: 0, level: ground.id }
  }
  return undefined
}
