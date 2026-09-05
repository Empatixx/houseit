import type { HouseDocument, HouseObject, Side } from '@houseit/core/document'
import { levelsOf } from '@houseit/core/levels'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { runOfWall } from '@houseit/geometry/sides'
import type { Draft } from 'immer'
import { CommandError } from './command-error'

/** The sides a command takes, as the enum a schema wants. */
export const SIDE_NAMES = ['north', 'south', 'east', 'west'] as const

/**
 * Finding what a command was told about.
 *
 * A command names a level and a room the way a person does — by name, or not at
 * all when there is only the one — and these are where that is turned into the
 * records the plan holds, with the refusal worded for the command that asked.
 */

/**
 * The storey a command was given — by name or by id, the way a room is — or the
 * lowest one there is, which is the whole house until somebody builds upwards.
 */
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

/**
 * The room of that name, and the storey it is on.
 *
 * A storey said is a storey meant: the room is looked for there and nowhere
 * else. Said nothing, every storey is looked at, lowest first — because "the
 * bedroom" is a room in the house, and which floor it is on is a thing the
 * plan knows and the person asking does not have to.
 */
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

/**
 * The room with that name, or with the id the last answer gave it, with its
 * record — a face nobody has named is not a room to a command.
 */
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

/** A wall of a room, said either way: by the side it is on, or by its own id. */
export type WallRef = { side?: Side; wall?: string }

/**
 * The side a command means, and which run of it. Said as a side, it is the
 * longest run of that side — the only one a rectangle has. Said as a wall
 * id, it is the run that wall is in, which is how the second north wall of
 * an L is reached.
 */
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

/**
 * The thing a command means, and the room it stands in.
 *
 * By id, and only by id. Every command answers with the rooms it touched and
 * every thing in them by id, so the id of the sofa just placed is in the answer
 * to placing it — "the second sofa in the living room" is a second way of
 * saying the same thing, and one of the two ways is always the wrong one.
 */
export function thingById(
  doc: HouseDocument | Draft<HouseDocument>,
  id: string,
  what: string,
): { object: HouseObject; room: Room & { id: string }; level: string } {
  const object = doc.objects[id]
  if (!object) throw new CommandError(`${what}: there is nothing called ${id}`)
  // An id is one thing in the whole house, so the storey comes off the thing
  // rather than being asked for: nobody knows which floor `f7` is on, and
  // nobody should have to say.
  const level = object.level
  const room = roomsOf(doc, level).find((candidate) => candidate.id === object.room)
  if (!room?.id) throw new CommandError(`${what}: ${id} stands in no room`)
  return { object: object as HouseObject, room: room as Room & { id: string }, level }
}

/**
 * The last thing added, which is the one with the highest number in its id.
 *
 * What the editor picks when a click lands on a stack of things, and how the
 * plan's own thumbnail decides what to show.
 */
export const newest = <T extends { id: string }>(entries: T[]): T | undefined =>
  entries.reduce<T | undefined>(
    (best, next) => (best === undefined || order(next.id) > order(best.id) ? next : best),
    undefined,
  )

/** Ids are a prefix and a number: `o12` came after `o3`. */
export const order = (id: string) => Number.parseInt(id.replace(/^\D+/, ''), 10) || 0
