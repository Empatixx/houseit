import type { HouseDocument } from '@houseit/core/document'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { type Standing, standingAt } from '@houseit/geometry/standing'
import { CommandError } from './command-error'

const COMPASS: Record<string, { x: number; y: number }> = {
  north: { x: 0, y: 1 },
  south: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
}

export function rotationFacing(
  doc: HouseDocument,
  level: string,
  room: Room,
  thing: Omit<Standing, 'rotation'>,
  facing: string,
  what: string,
): number {
  const square = standingAt(doc, level, room, { ...thing, rotation: 0 })
  if (!square) throw new CommandError(`${what}: cannot tell where it stands to turn it`)
  let direction = COMPASS[facing]
  if (!direction) {
    const other = doc.objects[facing]
    const home = other && roomsOf(doc, level).find((candidate) => candidate.id === other.room)
    const there = other && home ? standingAt(doc, level, home, other) : undefined
    if (!there)
      throw new CommandError(
        `${what}: --facing takes north, south, east, west or the id of a thing on this storey, not ${facing}`,
      )
    direction = { x: there.at.x - square.at.x, y: there.at.y - square.at.y }
  }
  const turn = Math.atan2(-direction.x, direction.y)
  const degrees = Math.round(((turn - square.turn) * 180) / Math.PI)
  return ((((degrees + 180) % 360) + 360) % 360) - 180
}
