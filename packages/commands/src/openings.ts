import type { HouseDocument, Opening, Side } from '@houseit/core/document'
import type { Room } from '@houseit/geometry/rooms'
import type { Draft } from 'immer'
import { CommandError } from './command-error'
import { sideSign, wallsFacing } from './place-opening'
import { nthOf, order } from './resolve'

/**
 * Naming a door or a window the way it was put in: by room, by side, and
 * which of them when there are several — the first from the order they went
 * in, the way `describe` numbers them. An id is not something anybody knows.
 */

/** The openings of a kind in the wall on one side of a room, oldest first. */
export function openingsOn(
  doc: HouseDocument | Draft<HouseDocument>,
  level: string,
  room: Room,
  side: Side,
  kind: Opening['kind'],
  what = 'openings',
): Opening[] {
  const walls = new Set(wallsFacing(doc, level, room, side, what).map((it) => it.wall.id))
  return Object.values(doc.openings)
    .filter((opening) => opening.kind === kind && walls.has(opening.wall))
    .sort((one, other) => order(one.id) - order(other.id)) as Opening[]
}

/** The opening a command means, or a refusal that says what is there instead. */
export function openingNamed(
  doc: HouseDocument | Draft<HouseDocument>,
  level: string,
  room: Room,
  kind: Opening['kind'],
  side: Side,
  nth: number | undefined,
  what: string,
): Opening {
  const all = openingsOn(doc, level, room, side, kind, what)
  const found = nthOf(all, nth)
  if (found) return found
  if (all.length === 0) {
    throw new CommandError(`${what}: there is no ${kind} in the ${side} wall of ${room.name}`)
  }
  throw new CommandError(
    `${what}: there is no ${nth}th ${kind} in the ${side} wall of ${room.name} — there are ${all.length}`,
  )
}

/**
 * The room an opening belongs to, for naming it: a door's is the room it
 * swings into; a window's is whichever room its wall bounds. Nothing for an
 * opening in a wall no room walks.
 */
export function roomOfOpening(
  doc: HouseDocument,
  rooms: Room[],
  opening: Opening,
): Room | undefined {
  const wall = doc.walls[opening.wall]
  const a = wall && doc.nodes[wall.a]
  const b = wall && doc.nodes[wall.b]
  if (!wall || !a || !b) return undefined
  const walking = rooms.filter((room) => {
    const count = room.nodes.length
    for (let i = 0; i < count; i += 1) {
      const from = room.nodes[i]!
      const to = room.nodes[(i + 1) % count]!
      if ((wall.a === from && wall.b === to) || (wall.a === to && wall.b === from)) return true
    }
    return false
  })
  if (opening.kind === 'door') {
    return walking.find((room) => sideSign(a, b, room.centre) === opening.swing) ?? walking[0]
  }
  return walking[0]
}
