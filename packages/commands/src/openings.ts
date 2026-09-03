import type { HouseDocument, Opening, Side } from '@houseit/core/document'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { runOfWall } from '@houseit/geometry/sides'
import type { Draft } from 'immer'
import { CommandError } from './command-error'
import { sideSign, wallsFacing } from './place-opening'
import { nthOf, order, roomNamed, sideNamed, type WallRef } from './resolve'

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
  nth?: number,
): Opening[] {
  const walls = new Set(wallsFacing(doc, level, room, side, what, nth).map((it) => it.wall.id))
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
  run?: number,
): Opening {
  const all = openingsOn(doc, level, room, side, kind, what, run)
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

/** A door or window, said either way: by its id from `describe`, or by room, side and which of them. */
export type OpeningRef = WallRef & { id?: string; room?: string; nth?: number }

/**
 * The opening a command means, with the room it belongs to and the side of
 * that room it is in — which is what putting it somewhere else starts from.
 */
export function openingRef(
  doc: HouseDocument | Draft<HouseDocument>,
  level: string,
  ref: OpeningRef,
  kind: Opening['kind'],
  what: string,
): { opening: Opening; room: Room & { id: string }; side: Side; run?: number } {
  if (ref.id !== undefined) {
    const opening = doc.openings[ref.id]
    if (!opening || doc.walls[opening.wall]?.level !== level) {
      throw new CommandError(`${what}: there is no ${kind} called ${ref.id}`)
    }
    if (opening.kind !== kind) {
      throw new CommandError(`${what}: ${ref.id} is a ${opening.kind}, not a ${kind}`)
    }
    const room = roomOfOpening(doc as HouseDocument, roomsOf(doc, level), opening as Opening)
    if (!room?.id) throw new CommandError(`${what}: ${ref.id} is in no room's wall`)
    const place = runOfWall(doc, level, room, opening.wall)
    if (!place) throw new CommandError(`${what}: ${ref.id} is in a wall on no side of ${room.name}`)
    return {
      opening: opening as Opening,
      room: room as Room & { id: string },
      side: place.side,
      run: place.nth,
    }
  }
  if (ref.room === undefined) {
    throw new CommandError(
      `${what}: say which ${kind} — --room and --side, or --id with its id from describe`,
    )
  }
  const room = roomNamed(doc, level, ref.room, what)
  const at = sideNamed(doc, level, room, ref, what)
  const opening = openingNamed(doc, level, room, kind, at.side, ref.nth, what, at.nth)
  return { opening, room, side: at.side, ...(at.nth === undefined ? {} : { run: at.nth }) }
}
