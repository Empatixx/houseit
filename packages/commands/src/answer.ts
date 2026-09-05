import type { HouseDocument } from '@houseit/core/document'
import { planExtent } from '@houseit/geometry/dimensions'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { checkLevel, type Problem } from './checks'
import { roomOfOpening } from './openings'
import { type RoomReport, surveyRoom } from './survey'

/**
 * What a command answers with.
 *
 * There is no command for looking, so every command has to say enough that the
 * next one can be written without asking. That is: what it touched, those rooms
 * read back in full — walls, openings, what stands there and what stretch of
 * each wall is still free — and everything now wrong with the plan.
 *
 * Only the touched rooms, because the whole plan on every line of a script is
 * noise nobody reads. The whole plan is `get-plan`, which is the one question
 * left, and the one worth asking rarely.
 */
export type Answer = {
  level: string
  /** The outside of the level, over the outer faces of its walls. */
  width?: number
  depth?: number
  /** Ids of what the command made or changed, in the order it did. */
  changed: string[]
  /** The rooms behind those ids, as they stand now. */
  rooms: RoomReport[]
  /** Everything wrong with the level, not only with what changed. */
  problems: Problem[]
}

export function answerFor(
  doc: HouseDocument,
  level: string,
  changed: string[],
  shown: string[] = [],
): Answer {
  const rooms = roomsOf(doc, level)
  const touched: Room[] = []
  for (const id of [...changed, ...shown]) {
    const room = roomBehind(doc, level, rooms, id)
    if (room && !touched.some((seen) => seen.id === room.id)) touched.push(room)
  }
  const extent = planExtent(doc, level)
  return {
    level,
    ...(extent
      ? { width: Math.round(extent.x1 - extent.x0), depth: Math.round(extent.y1 - extent.y0) }
      : {}),
    changed,
    rooms: touched.map((room) => surveyRoom(doc, level, room, rooms)),
    problems: checkLevel(doc, level),
  }
}

/**
 * The room an id belongs to: a room is itself, a door or window belongs to the
 * room it opens into, a thing to the room it stands in. An id of something
 * since taken out belongs to nothing, and is passed over — `changed` still
 * names it, so what went is still said.
 */
function roomBehind(
  doc: HouseDocument,
  level: string,
  rooms: Room[],
  id: string,
): Room | undefined {
  const room = rooms.find((candidate) => candidate.id === id)
  if (room) return room

  const opening = doc.openings[id]
  if (opening) return roomOfOpening(doc, rooms, opening)

  const object = doc.objects[id]
  if (object && object.level === level) {
    return rooms.find((candidate) => candidate.id === object.room)
  }
  return undefined
}
