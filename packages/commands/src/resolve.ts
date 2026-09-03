import type { HouseDocument, HouseObject, Side } from '@houseit/core/document'
import { objectType } from '@houseit/core/object-types'
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

/** The level a command was given, or the only one there is. */
export function levelOf(
  doc: HouseDocument | Draft<HouseDocument>,
  given: string | undefined,
  what: string,
) {
  const level = given ?? Object.keys(doc.levels)[0]
  if (!level || !doc.levels[level]) {
    throw new CommandError(`${what}: unknown level ${given ?? '<none>'}`)
  }
  return level
}

/**
 * The room with that name, or with that id as `describe` gives it, with its
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

/** A wall of a room, said either way: by the side it is on, or by its id from `describe`. */
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
  throw new CommandError(`${what}: say which wall — --side, or --wall with its id from describe`)
}

/** A thing, said either way: by its id from `describe`, or by room, type and which of that type. */
export type ThingRef = { id?: string; room?: string; type?: string; nth?: number }

/** The thing a command means, and the room it stands in. */
export function thingNamed(
  doc: HouseDocument | Draft<HouseDocument>,
  level: string,
  ref: ThingRef,
  what: string,
): { object: HouseObject; room: Room & { id: string } } {
  if (ref.id !== undefined) {
    const object = doc.objects[ref.id]
    if (!object || object.level !== level) {
      throw new CommandError(`${what}: there is nothing called ${ref.id}`)
    }
    const room = roomsOf(doc, level).find((candidate) => candidate.id === object.room)
    if (!room?.id) throw new CommandError(`${what}: ${ref.id} stands in no room`)
    return { object: object as HouseObject, room: room as Room & { id: string } }
  }
  if (ref.room === undefined || ref.type === undefined) {
    throw new CommandError(
      `${what}: say which thing — --room and --type, or --id with its id from describe`,
    )
  }
  const room = roomNamed(doc, level, ref.room, what)
  return { object: objectNamed(doc, level, room, ref.type, ref.nth, what), room }
}

/**
 * The last thing added, which is the one with the highest number in its id.
 *
 * Nothing names a thing by id: what anybody knows is that there is a rug in the
 * living room. So the rug meant, when there are two, is the one that went in
 * last — the same one `remove-object` would take out.
 */
export const newest = <T extends { id: string }>(entries: T[]): T | undefined =>
  entries.reduce<T | undefined>(
    (best, next) => (best === undefined || order(next.id) > order(best.id) ? next : best),
    undefined,
  )

/** Ids are a prefix and a number: `o12` came after `o3`. */
export const order = (id: string) => Number.parseInt(id.replace(/^\D+/, ''), 10) || 0

/**
 * The nth thing of a kind in the order they went in, counting from one; none
 * asked for, the last. Two nightstands are "the first" and "the second", which
 * is what a person says and what `describe` reports — an id is not.
 */
export function nthOf<T extends { id: string }>(
  entries: T[],
  nth: number | undefined,
): T | undefined {
  const sorted = [...entries].sort((one, other) => order(one.id) - order(other.id))
  return nth === undefined ? sorted.at(-1) : sorted[nth - 1]
}

/** The thing a command means: of this type, in this room, the nth or the last. */
export function objectNamed(
  doc: HouseDocument | Draft<HouseDocument>,
  level: string,
  room: Room & { id: string },
  type: string,
  nth: number | undefined,
  what: string,
): HouseObject {
  const label = objectType(type)?.label.toLowerCase() ?? type
  const ofType = Object.values(doc.objects).filter(
    (object) => object.level === level && object.room === room.id && object.type === type,
  )
  const found = nthOf(ofType, nth)
  if (found) return found as HouseObject
  if (ofType.length === 0) throw new CommandError(`${what}: there is no ${label} in ${room.name}`)
  throw new CommandError(
    `${what}: there is no ${nth}th ${label} in ${room.name} — there are ${ofType.length}`,
  )
}
