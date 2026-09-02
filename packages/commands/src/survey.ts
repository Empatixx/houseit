import type { HouseDocument, HouseObject, Opening, Side, Wall } from '@houseit/core/document'
import { boundaryWallsOf } from '@houseit/geometry/boundary'
import { interiorSize, planExtent, roomDimensions } from '@houseit/geometry/dimensions'
import type { Point } from '@houseit/geometry/outlines'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { sideFacing, sideOfWall, sideRun, wallsOnSide } from '@houseit/geometry/sides'
import { standingAt } from '@houseit/geometry/standing'
import { order } from './resolve'

/**
 * What the plan says about itself.
 *
 * An agent that can only act through commands can only know the plan through
 * commands too, and a document dump is not knowing it: the rooms in a document
 * are anchor points, the doors are fractions along wall ids. What is said here
 * is what a person looking at the drawing would say — the kitchen is 4.2 by
 * 3.6, its door is in the south wall and opens from the hall, a sofa stands
 * against its west wall — in the same words the commands take, so that what is
 * read back can be written straight into the next command.
 *
 * Lengths are millimetres, as everywhere; an area is in square metres because
 * that is the unit anybody thinks of a room in.
 */

export type WallReport = { side: Side; length: number }

export type DoorReport = {
  side: Side
  /** Which of the doors in that wall, counting from one — only when there are several. */
  nth?: number
  /** Along that side, in the sense `add-object --along` uses: 0 west or south, 1 east or north. */
  along: number
  width: number
  variant: Opening['variant']
  /** The room it opens from, or `outside`. */
  to: string
}

export type WindowReport = { side: Side; nth?: number; along: number; width: number }

export type ObjectReport = {
  type: string
  /** Which of its type in the room, counting from one — only when there are several. */
  nth?: number
  against?: Side
  along: number
  across?: number
  turn?: number
  seats?: number
  width: number
  depth: number
  surface: string
  /** The middle of it, in plan millimetres. */
  at?: Point
}

export type RoomReport = {
  name?: string
  /** What sort of room it was told it is; left out, read from the name. */
  kind?: string
  areaM2: number
  /** Clear width and depth, between wall faces. */
  width: number
  depth: number
  /** Where it lies on the plan: the box round its wall centre lines. */
  box: { x0: number; y0: number; x1: number; y1: number }
  floor?: string
  /** Rooms sharing a wall with it, by name. */
  neighbours: string[]
  walls: WallReport[]
  doors: DoorReport[]
  windows: WindowReport[]
  objects: ObjectReport[]
}

export type LevelReport = {
  level: string
  /** The outside of the level, over the outer faces of its walls. */
  width?: number
  depth?: number
  rooms: RoomReport[]
}

export function surveyLevel(doc: HouseDocument, level: string): LevelReport {
  const rooms = roomsOf(doc, level)
  const extent = planExtent(doc, level)
  return {
    level,
    ...(extent
      ? { width: Math.round(extent.x1 - extent.x0), depth: Math.round(extent.y1 - extent.y0) }
      : {}),
    rooms: rooms.map((room) => surveyRoom(doc, level, room, rooms)),
  }
}

export function surveyRoom(
  doc: HouseDocument,
  level: string,
  room: Room,
  rooms: Room[] = roomsOf(doc, level),
): RoomReport {
  const corners = room.nodes.map((id) => doc.nodes[id]).filter((node) => node !== undefined)
  const xs = corners.map((corner) => corner.x)
  const ys = corners.map((corner) => corner.y)
  const walls = boundaryWallsOf(doc, level, room)
  const walled = new Set(walls.map((wall) => wall.id))
  const openings = Object.values(doc.openings)
    .filter((opening) => walled.has(opening.wall))
    .sort((one, other) => order(one.id) - order(other.id))

  const doors: DoorReport[] = []
  const windows: WindowReport[] = []
  for (const opening of openings) {
    const wall = doc.walls[opening.wall]
    const side = sideOfWall(doc, level, room, opening.wall)
    if (!wall || !side) continue
    const along = alongSide(doc, level, room, side, wall, opening.t)
    if (opening.kind === 'door') {
      const across = rooms.find((other) => !sameFace(other, room) && walks(other, wall))
      doors.push({
        side,
        along,
        width: opening.width,
        variant: opening.variant,
        to: across ? (across.name ?? '(unnamed)') : 'outside',
      })
    } else {
      windows.push({ side, along, width: opening.width })
    }
  }

  // Two doors in one wall are told apart by number, the way move-door takes them.
  for (const list of [doors, windows]) {
    for (const side of new Set(list.map((it) => it.side))) {
      const onSide = list.filter((it) => it.side === side)
      if (onSide.length > 1) {
        onSide.forEach((it, index) => {
          it.nth = index + 1
        })
      }
    }
  }

  const neighbours = rooms
    .filter((other) => !sameFace(other, room) && walls.some((wall) => walks(other, wall)))
    .map((other) => other.name)
    .filter((name) => name !== undefined)

  return {
    ...(room.name === undefined ? {} : { name: room.name }),
    ...(room.kind === undefined ? {} : { kind: room.kind }),
    areaM2: Math.round(room.area / 10_000) / 100,
    ...interiorSize(doc, level, room),
    box: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) },
    ...(room.floor === undefined ? {} : { floor: room.floor }),
    neighbours,
    walls: roomDimensions(doc, level, room).map((dimension) => ({
      side: sideFacing(dimension.offset),
      length: dimension.length,
    })),
    doors,
    windows,
    objects: objectsIn(doc, level, room).map((object, _, all) =>
      surveyObject(doc, level, room, object, all),
    ),
  }
}

/** What stands in a room, in the order it was put there. */
export function objectsIn(doc: HouseDocument, level: string, room: Room): HouseObject[] {
  return Object.values(doc.objects)
    .filter((object) => object.level === level && object.room === room.id)
    .sort((one, other) => order(one.id) - order(other.id))
}

export function surveyObject(
  doc: HouseDocument,
  level: string,
  room: Room,
  object: HouseObject,
  among: HouseObject[] = objectsIn(doc, level, room),
): ObjectReport {
  const spot = standingAt(doc, level, room, object)
  const ofType = among.filter((other) => other.type === object.type)
  const nth = ofType.length > 1 ? ofType.indexOf(object) + 1 : undefined
  return {
    type: object.type,
    ...(nth === undefined ? {} : { nth }),
    ...(object.against === undefined ? {} : { against: object.against }),
    along: object.along,
    ...(object.across === undefined ? {} : { across: object.across }),
    ...(object.turn === undefined ? {} : { turn: object.turn }),
    ...(object.seats === undefined ? {} : { seats: object.seats }),
    width: object.width,
    depth: object.depth,
    surface: object.surface,
    ...(spot ? { at: { x: Math.round(spot.at.x), y: Math.round(spot.at.y) } } : {}),
  }
}

/**
 * Whether two rooms are the same face. Faces are made afresh on every look, so
 * the one a command was handed and the one in a list are never the same object;
 * the ring of nodes is what they have in common.
 */
const sameFace = (one: Room, other: Room) =>
  one.nodes.length === other.nodes.length &&
  [...one.nodes].sort().join('-') === [...other.nodes].sort().join('-')

/** Whether a room's face runs along a wall. */
function walks(room: Room, wall: Wall): boolean {
  const count = room.nodes.length
  for (let i = 0; i < count; i += 1) {
    const a = room.nodes[i]!
    const b = room.nodes[(i + 1) % count]!
    if ((wall.a === a && wall.b === b) || (wall.a === b && wall.b === a)) return true
  }
  return false
}

/**
 * Where along a side an opening sits, as the fraction `add-object --along` would
 * put a thing at the same place.
 *
 * Measured along the side's run — west to east, south to north — when the wall
 * is on the room's edge, so a door and a sofa on the same wall are told apart by
 * the one number. A wall the room only reaches, not one at its edge, is measured
 * along itself the same way round.
 */
function alongSide(
  doc: HouseDocument,
  level: string,
  room: Room,
  side: Side,
  wall: Wall,
  t: number,
): number {
  const a = doc.nodes[wall.a]
  const b = doc.nodes[wall.b]
  if (!a || !b) return 0
  const centre = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }

  const onEdge = wallsOnSide(doc, level, room, side).some((it) => it.wall === wall.id)
  const run = onEdge ? sideRun(doc, level, room, side) : undefined
  const [from, to] = run
    ? [run.from, run.to]
    : a.x === b.x
      ? a.y <= b.y
        ? [a, b]
        : [b, a]
      : a.x <= b.x
        ? [a, b]
        : [b, a]

  const span = (to.x - from.x) ** 2 + (to.y - from.y) ** 2
  if (span === 0) return 0
  const along =
    ((centre.x - from.x) * (to.x - from.x) + (centre.y - from.y) * (to.y - from.y)) / span
  return Math.round(Math.min(1, Math.max(0, along)) * 1000) / 1000
}
