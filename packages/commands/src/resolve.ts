import type { HouseDocument, HouseObject, Side } from '@houseit/core/document'
import { levelsOf } from '@houseit/core/levels'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { runOfWall } from '@houseit/geometry/sides'
import type { Draft } from 'immer'
import { CommandError } from './command-error'

export const SIDE_NAMES = ['north', 'south', 'east', 'west'] as const

export function levelOf(
  doc: HouseDocument | Draft<HouseDocument>,
  given: string | undefined,
  what: string,
) {
  const stack = levelsOf(doc as HouseDocument)
  if (given === undefined) {
    const ground = stack[0]
    if (!ground) throw new CommandError(`${what}: this plan has no storeys`)
    return ground.id
  }
  const found = stack.find((level) => level.id === given || level.name === given)
  if (!found) {
    throw new CommandError(
      `${what}: there is no storey called ${given} — there is ${stack.map((it) => it.name).join(', ')}`,
    )
  }
  return found.id
}

export function whereRoom(
  doc: HouseDocument | Draft<HouseDocument>,
  given: string | undefined,
  name: string,
  what: string,
): { room: Room & { id: string }; level: string } {
  if (given !== undefined) {
    const level = levelOf(doc, given, what)
    return { room: roomNamed(doc, level, name, what), level }
  }

  const stack = levelsOf(doc as HouseDocument)
  for (const storey of stack) {
    const room = roomsOf(doc, storey.id).find(
      (candidate) =>
        candidate.name === name || (candidate.id !== undefined && candidate.id === name),
    )
    if (room?.id) return { room: room as Room & { id: string }, level: storey.id }
  }
  throw new CommandError(`${what}: there is no room called ${name}`)
}

export function roomNamed(
  doc: HouseDocument | Draft<HouseDocument>,
  level: string,
  name: string,
  what: string,
): Room & { id: string } {
  const room = roomsOf(doc, level).find(
    (candidate) => candidate.name === name || (candidate.id !== undefined && candidate.id === name),
  )
  if (!room?.id) throw new CommandError(`${what}: there is no room called ${name}`)
  return room as Room & { id: string }
}

export type WallRef = { side?: Side; wall?: string }

export function sideNamed(
  doc: HouseDocument | Draft<HouseDocument>,
  level: string,
  room: Room,
  ref: WallRef,
  what: string,
): { side: Side; nth?: number; wall?: string } {
  if (ref.wall !== undefined) {
    const place = runOfWall(doc, level, room, ref.wall)
    if (!place) throw new CommandError(`${what}: ${room.name} has no wall ${ref.wall}`)
    return { side: place.side, nth: place.nth, wall: ref.wall }
  }
  if (ref.side !== undefined) return { side: ref.side }
  throw new CommandError(`${what}: say which wall — --side, or --wall with its id`)
}

export function thingById(
  doc: HouseDocument | Draft<HouseDocument>,
  id: string,
  what: string,
): { object: HouseObject; room: Room & { id: string }; level: string } {
  const object = doc.objects[id]
  if (!object) throw new CommandError(`${what}: there is nothing called ${id}`)
  const level = object.level
  const room = roomsOf(doc, level).find((candidate) => candidate.id === object.room)
  if (!room?.id) throw new CommandError(`${what}: ${id} stands in no room`)
  return { object: object as HouseObject, room: room as Room & { id: string }, level }
}

export const order = (id: string) => Number.parseInt(id.replace(/^\D+/, ''), 10) || 0
