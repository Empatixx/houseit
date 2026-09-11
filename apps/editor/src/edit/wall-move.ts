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
    by: Math.round((shift[axis] * outward) / 10) * 10,
  }
}
