import { moveWall } from '@houseit/commands/move-wall'
import { removeRoom } from '@houseit/commands/remove-room'
import type { Wall } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { SIDES, sideOfWall } from '@houseit/geometry/sides'
import { noticeStore } from '../store/notice'
import { documentStore } from '../store/store'
import { runEdit } from './run-edit'

/** What a drag of a wall, or a button on a room, does — as the commands an agent would give. */

/** Moves a wall by however far across itself it was carried, as `move-wall` on a room it bounds. */
export function moveWallBy(wall: Wall, shift: Point): boolean {
  const named = nameWall(wall)
  if (!named) return false
  const { axis, low } = SIDES[named.side]
  const outward = low ? -1 : 1
  // Only the part of the carry that is across the wall counts, to the nearest centimetre.
  const by = Math.round((shift[axis] * outward) / 10) * 10
  if (by === 0) return true
  return runEdit(() =>
    documentStore.getState().apply(moveWall, { room: named.room.name, side: named.side, by }),
  )
}

/** Knocks a room through into a neighbour. */
export function knockThrough(room: Room, into: string): boolean {
  if (!room.name) return false
  return runEdit(() => documentStore.getState().apply(removeRoom, { room: room.name!, into }))
}

/**
 * A wall the way `move-wall` names it: a room it bounds and the side of that
 * room it is on. Any room bounding it will do — moving the wall moves it for
 * both — so the first named one is taken.
 */
export function nameWall(wall: Wall) {
  const { doc, level } = documentStore.getState()
  for (const room of roomsOf(doc, level)) {
    if (!room.name) continue
    const side = sideOfWall(doc, level, room, wall.id)
    if (side) return { room: { ...room, name: room.name }, side }
  }
  noticeStore.getState().say('this wall bounds no named room, so nothing can be said about it')
  return undefined
}
