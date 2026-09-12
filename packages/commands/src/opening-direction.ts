import type { HouseDocument, Opening, Wall } from '@houseit/core/document'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { CommandError } from './command-error'
import { whereRoom } from './resolve'

export function hasDoor(opening: Pick<Opening, 'kind' | 'panels'>): boolean {
  return opening.kind === 'door' || !!opening.panels?.some((p) => p.kind === 'door')
}

export function touchesWall(room: Room, wall: Wall): boolean {
  return room.nodes.some((from, i) => {
    const to = room.nodes[(i + 1) % room.nodes.length]
    return (wall.a === from && wall.b === to) || (wall.b === from && wall.a === to)
  })
}

export function sideSign(
  a: { x: number; y: number },
  b: { x: number; y: number },
  point: { x: number; y: number },
): -1 | 1 {
  return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x) < 0 ? -1 : 1
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
  const a = doc.nodes[wall.a]!,
    b = doc.nodes[wall.b]!
  if (into === undefined) return sideSign(a, b, room.centre)
  if (into === 'outside') {
    const adjacent = roomsOf(doc, level).filter((r) => touchesWall(r, wall))
    if (adjacent.length !== 1)
      throw new CommandError(
        `${what}: this wall is not an exterior boundary, so it cannot open outside`,
      )
    return sideSign(a, b, adjacent[0]!.centre) === 1 ? -1 : 1
  }
  const target = whereRoom(doc, level, into, what).room
  if (!touchesWall(target, wall)) throw new CommandError(`${what}: ${into} is not beside this wall`)
  return sideSign(a, b, target.centre)
}

export function opensIntoOf(doc: HouseDocument, rooms: Room[], opening: Opening): string {
  const wall = doc.walls[opening.wall]!
  const a = doc.nodes[wall.a]!,
    b = doc.nodes[wall.b]!
  const target = rooms.find(
    (r) => touchesWall(r, wall) && sideSign(a, b, r.centre) === opening.swing,
  )
  return target?.name ?? target?.id ?? (target ? '(unnamed)' : 'outside')
}
