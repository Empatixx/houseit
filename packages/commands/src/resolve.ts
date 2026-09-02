import type { HouseDocument, HouseObject } from '@houseit/core/document'
import { objectType } from '@houseit/core/object-types'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import type { Draft } from 'immer'
import { CommandError } from './command-error'

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

/** The room with that name, with its record — a face nobody has named is not a room to a command. */
export function roomNamed(
  doc: HouseDocument | Draft<HouseDocument>,
  level: string,
  name: string,
  what: string,
): Room & { id: string } {
  const room = roomsOf(doc, level).find((candidate) => candidate.name === name)
  if (!room?.id) throw new CommandError(`${what}: there is no room called ${name}`)
  return room as Room & { id: string }
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
