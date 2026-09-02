import type { HouseDocument } from '@houseit/core/document'
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
