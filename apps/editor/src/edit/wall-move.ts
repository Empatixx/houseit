import type { HouseDocument, Side, Wall } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { SIDES, sideOfWall } from '@houseit/geometry/sides'
import { roomRef } from './room-ref'

export type NamedWall = { room: Room & { name: string }; side: Side }

export function wallNamedBy(
  doc: HouseDocument,
  level: string,
  wall: Wall,
  roomId?: string,
): NamedWall | undefined {
  const rooms = roomsOf(doc, level)
  const chosen = roomId === undefined ? undefined : rooms.find((room) => room.id === roomId)
  const order = chosen ? [chosen, ...rooms.filter((room) => room !== chosen)] : rooms
  for (const room of order) {
    if (!room.name) continue
    const side = sideOfWall(doc, level, room, wall.id)
    if (side) return { room: { ...room, name: room.name }, side }
  }
  return undefined
}

export function wallMoveArgsOf(
  doc: HouseDocument,
  level: string,
  wall: Wall,
  shift: Point,
  roomId?: string,
): { room: string; wall: string; by: number } | undefined {
  const named = wallNamedBy(doc, level, wall, roomId)
  if (!named) return undefined
  const { axis, low } = SIDES[named.side]
  const outward = low ? -1 : 1
  return {
    room: roomRef(named.room) ?? named.room.name,
    wall: wall.id,
    by: Math.round(shift[axis] * outward),
  }
}

export function alignWallShift(
  doc: HouseDocument,
  wall: Wall,
  shift: Point,
  tolerance: number,
): Point {
  const a = doc.nodes[wall.a]!,
    b = doc.nodes[wall.b]!
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  const nx = -(b.y - a.y) / length,
    ny = (b.x - a.x) / length
  const offset = nx * shift.x + ny * shift.y
  let correction = tolerance
  let found = false
  for (const target of wallAlignmentShifts(doc, wall)) {
    const delta = nx * target.x + ny * target.y - offset
    if (Math.abs(delta) >= Math.abs(correction)) continue
    correction = delta
    found = true
  }
  return found ? { x: shift.x + nx * correction, y: shift.y + ny * correction } : shift
}

export function wallAlignmentShifts(doc: HouseDocument, wall: Wall): Point[] {
  const a = doc.nodes[wall.a]!,
    b = doc.nodes[wall.b]!
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  const nx = -(b.y - a.y) / length,
    ny = (b.x - a.x) / length
  const offsets = new Set<number>()
  for (const other of Object.values(doc.walls)) {
    if (other.level !== wall.level || other.id === wall.id) continue
    const from = doc.nodes[other.a]!,
      to = doc.nodes[other.b]!
    const span = Math.hypot(to.x - from.x, to.y - from.y)
    if (Math.abs(nx * (to.x - from.x) + ny * (to.y - from.y)) > span * 1e-6) continue
    offsets.add(nx * (from.x - a.x) + ny * (from.y - a.y))
  }
  return [...offsets].map((offset) => ({ x: nx * offset, y: ny * offset }))
}
