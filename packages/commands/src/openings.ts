import type { HouseDocument, Opening, Side } from '@houseit/core/document'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { runOfWall } from '@houseit/geometry/sides'
import type { Draft } from 'immer'
import { CommandError } from './command-error'
import { sideSign } from './place-opening'

/**
 * Finding a door or a window that is already in.
 *
 * By id, and only by id. Every command that changes anything answers with the
 * rooms it touched and every opening in them by id, so the id of the door just
 * hung is in the answer to hanging it — there is nothing left for "the second
 * door on the north side" to do except be another way of saying the same thing
 * wrong.
 */

/**
 * The room an opening belongs to: a door's is the room it swings into; a
 * window's is whichever room its wall bounds. Nothing for an opening in a wall
 * no room walks.
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

/**
 * The opening a command means, with the room it belongs to and the side of
 * that room it is in — which is what putting it somewhere else starts from.
 */
export function openingById(
  doc: HouseDocument | Draft<HouseDocument>,
  id: string,
  what: string,
): { opening: Opening; room: Room & { id: string }; side: Side; level: string; run?: number } {
  const opening = doc.openings[id]
  const level = opening ? doc.walls[opening.wall]?.level : undefined
  if (!opening || level === undefined) {
    throw new CommandError(`${what}: there is no door or window called ${id}`)
  }
  const room = roomOfOpening(doc as HouseDocument, roomsOf(doc, level), opening as Opening)
  if (!room?.id) throw new CommandError(`${what}: ${id} is in no room's wall`)
  const place = runOfWall(doc, level, room, opening.wall)
  if (!place) throw new CommandError(`${what}: ${id} is in a wall on no side of ${room.name}`)
  return {
    opening: opening as Opening,
    room: room as Room & { id: string },
    side: place.side,
    level,
    run: place.nth,
  }
}
