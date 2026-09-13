import type { HouseDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { SIDES, sideOfWall } from '@houseit/geometry/sides'
import { CommandError } from './command-error'
import { rebind } from './rebind'
import { validateWalls } from './wall'
import { furnitureBefore, retainFurniture } from './wall-furniture'
import { moveWallTopology } from './wall-topology'

export function moveRoomBoundary(
  doc: HouseDocument,
  roomId: string,
  wallId: string,
  by: number,
): { changed: string[]; at: string } {
  try {
    const room = doc.rooms[roomId]
    const wall = doc.walls[wallId]
    if (!room || !wall || !room.loop.includes(wallId))
      throw new CommandError('select a wall segment on this room boundary')
    if (by === 0) return { changed: [], at: room.level }
    const before = roomsOf(doc, room.level)
    const face = before.find((r) => r.id === roomId)!
    const side = sideOfWall(doc, room.level, face, wallId)
    if (!side) throw new CommandError('this boundary has no outward direction')
    const { axis, low } = SIDES[side]
    const a = doc.nodes[wall.a]!,
      b = doc.nodes[wall.b]!
    const span = Math.hypot(b.x - a.x, b.y - a.y)
    const normal = axis === 'x' ? -(b.y - a.y) / span : (b.x - a.x) / span
    const distance = Math.round(by * (low ? -1 : 1) * normal)
    const furniture = furnitureBefore(doc, room.level)
    const affected = moveWallTopology(doc, wallId, distance, 'segment')
    validateWalls(doc, room.level)
    rebind(doc, room.level)
    const after = roomsOf(doc, room.level)
    if (after.length !== before.length || before.some((r) => r.id && !doc.rooms[r.id]?.loop.length))
      throw new CommandError('this move would destroy or divide an existing room')
    retainFurniture(doc, room.level, furniture)
    return {
      changed: [...new Set([...affected, ...before.flatMap((r) => (r.id ? [r.id] : []))])],
      at: room.level,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new CommandError(`move-wall: ${message.replace(/^(?:(?:move|update)-wall: )+/, '')}`)
  }
}
