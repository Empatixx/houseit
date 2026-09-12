import type { HouseDocument, Opening, Wall } from '@houseit/core/document'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { CommandError } from './command-error'
import { whereRoom } from './resolve'

export function hasDoor(opening: Pick<Opening, 'kind' | 'panels'>): boolean {
  return opening.kind === 'door' || !!opening.panels?.some((p) => p.kind === 'door')
}

export function touchesWall(room: Room, wall: Wall): boolean {
  return roomSide(room, wall) !== undefined
}

export function roomSide(room: Room, wall: Wall): -1 | 1 | undefined {
  // findFaces returns counterclockwise bounded faces: their inside is on the left.
  // A concave room's centroid need not be on that side of every boundary wall.
  for (let i = 0; i < room.nodes.length; i++) {
    const from = room.nodes[i],
      to = room.nodes[(i + 1) % room.nodes.length]
    if (wall.a === from && wall.b === to) return 1
    if (wall.b === from && wall.a === to) return -1
  }
  return undefined
}

export function directionAt(
  doc: HouseDocument,
  level: string,
  wallId: string,
  room: Room,
  into: string | undefined,
  what: string,
): -1 | 1 {
  const wall = doc.walls[wallId]!
  if (into === 'outside') {
    const adjacent = roomsOf(doc, level).filter((r) => touchesWall(r, wall))
    if (adjacent.length !== 1)
      throw new CommandError(
        `${what}: this wall is not an exterior boundary, so it cannot open outside`,
      )
    return roomSide(adjacent[0]!, wall) === 1 ? -1 : 1
  }
  const target = into === undefined ? room : whereRoom(doc, level, into, what).room
  const side = roomSide(target, wall)
  if (side === undefined)
    throw new CommandError(`${what}: ${into ?? room.name} is not beside this wall`)
  return side
}

export function opensIntoOf(doc: HouseDocument, rooms: Room[], opening: Opening): string {
  const wall = doc.walls[opening.wall]!
  const target = rooms.find((r) => roomSide(r, wall) === opening.swing)
  return target?.name ?? target?.id ?? (target ? '(unnamed)' : 'outside')
}
