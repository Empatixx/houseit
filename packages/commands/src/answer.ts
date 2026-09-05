import type { HouseDocument } from '@houseit/core/document'
import { flightOf, levelsOf } from '@houseit/core/levels'
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
/**
 * A storey of the house, as the agent has to know it to say `--level`.
 *
 * Always all of them, in every answer. There are never many, they are three
 * numbers each, and a command that cannot see what storeys there are cannot
 * write the next one.
 */
export type StoreyReport = {
  id: string
  name: string
  /** Counting the lowest as the first. */
  storey: number
  /** Floor to floor, which is what a flight of stairs out of it has to climb. */
  height: number
  /** Its floor above the origin. */
  elevation: number
  /** How many risers a staircase leaving this storey has. */
  risers: number
  rooms: number
  /** The storey the answer is about, which is the one the tab has open. */
  open?: true
}

export type Answer = {
  level: string
  /** Every storey of the house, lowest first. */
  levels: StoreyReport[]
  /** The outside of the level, over the outer faces of its walls. */
  width?: number
  depth?: number
  /** Ids of what the command made or changed, in the order it did. */
  changed: string[]
  /** The rooms behind those ids, as they stand now. */
  rooms: RoomReport[]
  /** Everything wrong with the level, not only with what changed. */
  problems: Problem[]
  /**
   * What the commands did beyond what they were asked. Nothing wrong — a thing
   * carried past a wall and rehoused in the room it landed in is the command
   * doing the obvious thing, and saying so is how it stays obvious.
   */
  notes?: string[]
}

export function answerFor(
  doc: HouseDocument,
  open: string,
  changed: string[],
  shown: string[] = [],
  /** The storey a command said it was about, where it said so outright. */
  about?: string,
  /** What the commands did beyond what they were asked. */
  notes?: string[],
): Answer {
  // Each id is looked for on the storey it belongs to, not on the one the tab
  // has open. A script that builds the first floor while you stand on the
  // ground floor answered with nothing at all until this was here.
  const touched: { room: Room; level: string }[] = []
  for (const id of [...changed, ...shown]) {
    const found = roomBehind(doc, open, id)
    if (found && !touched.some((seen) => seen.room.id === found.room.id)) touched.push(found)
  }

  // The answer is about the storey it worked on, which is not always the one
  // being looked at — and that is what the checks are run for as well. A storey
  // named outright wins: `get-plan --level půda` is about the loft even when
  // nobody has drawn a room on it to say so.
  const level = about ?? touched[0]?.level ?? open
  const extent = planExtent(doc, level)
  return {
    level,
    levels: levelsOf(doc).map((storey, index) => ({
      id: storey.id,
      name: storey.name,
      storey: index + 1,
      height: storey.height,
      elevation: storey.elevation,
      risers: flightOf(storey.height).risers,
      rooms: roomsOf(doc, storey.id).length,
      ...(storey.id === level ? { open: true as const } : {}),
    })),
    ...(extent
      ? { width: Math.round(extent.x1 - extent.x0), depth: Math.round(extent.y1 - extent.y0) }
      : {}),
    changed,
    rooms: touched.map((it) => surveyRoom(doc, it.level, it.room, roomsOf(doc, it.level))),
    problems: checkLevel(doc, level),
    ...(notes === undefined || notes.length === 0 ? {} : { notes }),
  }
}

/**
 * The room an id belongs to, and the storey it is on: a room is itself, a door
 * or window belongs to the room it opens into, a thing to the room it stands
 * in. An id of something since taken out belongs to nothing, and is passed over
 * — `changed` still names it, so what went is still said.
 */
function roomBehind(
  doc: HouseDocument,
  open: string,
  id: string,
): { room: Room; level: string } | undefined {
  const stored = doc.rooms[id]
  const object = doc.objects[id]
  const opening = doc.openings[id]
  const level =
    stored?.level ?? object?.level ?? (opening ? doc.walls[opening.wall]?.level : undefined) ?? open

  const rooms = roomsOf(doc, level)
  if (stored) {
    const room = rooms.find((candidate) => candidate.id === id)
    return room ? { room, level } : undefined
  }
  if (opening) {
    const room = roomOfOpening(doc, rooms, opening)
    return room ? { room, level } : undefined
  }
  if (object) {
    const room = rooms.find((candidate) => candidate.id === object.room)
    return room ? { room, level } : undefined
  }
  return undefined
}
