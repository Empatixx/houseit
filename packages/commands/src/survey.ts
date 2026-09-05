import type { HouseDocument, HouseObject, Opening, Side, Wall } from '@houseit/core/document'
import { boundaryWallsOf } from '@houseit/geometry/boundary'
import { interiorSize, objectClearances, planExtent } from '@houseit/geometry/dimensions'
import type { Point } from '@houseit/geometry/outlines'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import {
  runOfWall,
  SIDE_NAMES,
  type SideRun,
  sideOfWall,
  sideRun,
  sideRuns,
  stretchOf,
  wallsOnSide,
} from '@houseit/geometry/sides'
import { freeSpans } from '@houseit/geometry/spans'
import { footprintOf, standingAt } from '@houseit/geometry/standing'
import { order } from './resolve'

/**
 * What the plan says about itself.
 *
 * An agent that can only act through commands can only know the plan through
 * commands too, and a document dump is not knowing it: the rooms in a document
 * are anchor points, the doors are fractions along wall ids. What is said here
 * is what a person looking at the drawing would say — the kitchen is 4.2 by
 * 3.6, its door is in the south wall and opens from the hall, a sofa stands
 * against its west wall, and there are 1462 mm of that wall still free — in the
 * same words the commands take, so that what is read back can be written
 * straight into the next command.
 *
 * There is no command for any of this. It is what every command answers with
 * about the rooms it touched, which is why the free stretches live here beside
 * the room rather than behind a second question nobody remembers to ask.
 *
 * Lengths are millimetres, as everywhere; an area is in square metres because
 * that is the unit anybody thinks of a room in.
 */

export type WallReport = {
  /** Its id, which add-opening takes as --wall. */
  id: string
  side: Side
  /** Which run of that side, west to east or south to north — only where the side has several. */
  nth?: number
  length: number
}

export type OpeningReport = {
  /** Its id, which update-opening and remove-opening take as --id. */
  id: string
  kind: Opening['kind']
  /** The wall it is in. */
  wall: string
  side: Side
  /** Along that side, in the sense `--along` uses: 0 west or south, 1 east or north. */
  along: number
  width: number
  height: number
  /** A door's kind of leaf; absent on a window, which has no leaf. */
  variant?: Opening['variant']
  /** How high off the floor it starts. Nothing for a door. */
  sill?: number
  /** For a door: the room it opens from, or `outside`. */
  to?: string
}

export type ObjectReport = {
  /** Its id, which update-object and remove-object take as --id. */
  id: string
  type: string
  against?: Side
  /** The wall it backs onto, for --wall. */
  wall?: string
  along: number
  across?: number
  /** Its turn about its own middle, in whole degrees. Absent means square on. */
  rotation?: number
  seats?: number
  width: number
  depth: number
  surface: string
  /** The middle of it, in plan millimetres. */
  at?: Point
  /**
   * From each side of its box to the face of the first wall that way, in
   * millimetres. A side it backs onto is left out — there is nothing there to
   * measure. This is the room to walk round it, which is the question asked of
   * a plan more often than any other.
   */
  clear?: Record<string, number>
}

/** A stretch of a wall, in millimetres from the run's west or south end. */
export type Span = { from: number; to: number }

/**
 * One run of one side of a room, as a line to put things along.
 *
 * The measurement that matters and the only one that cannot be worked out from
 * the rest: what is on this wall already, and what is left. `from` and `to` are
 * the millimetres a `--along` of that length lands on, so a free stretch reads
 * straight back into the next command.
 */
export type SideReport = {
  side: Side
  /** Which run of that side — only where the side has several. */
  nth?: number
  /** The walls this run is made of, each with its own stretch of it. */
  walls: (Span & { id: string })[]
  length: number
  thickness: number
  openings: (Span & { id: string; kind: Opening['kind'] })[]
  objects: (Span & { id: string; type: string })[]
  free: Span[]
}

export type RoomReport = {
  /** Its id, which every command takes in place of the name. */
  id?: string
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
  /** Each side of it as a line to place against, with what is free. */
  sides: SideReport[]
  openings: OpeningReport[]
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
  const found = Object.values(doc.openings)
    .filter((opening) => walled.has(opening.wall))
    .sort((one, other) => order(one.id) - order(other.id))

  const openings: OpeningReport[] = []
  for (const opening of found) {
    const wall = doc.walls[opening.wall]
    const side = sideOfWall(doc, level, room, opening.wall)
    if (!wall || !side) continue
    const across = rooms.find((other) => !sameFace(other, room) && walks(other, wall))
    openings.push({
      id: opening.id,
      kind: opening.kind,
      wall: opening.wall,
      side,
      along: alongSide(doc, level, room, side, wall, opening.t),
      width: opening.width,
      height: opening.height,
      ...(opening.kind === 'door'
        ? { variant: opening.variant, to: across ? (across.name ?? '(unnamed)') : 'outside' }
        : { sill: opening.sillHeight }),
    })
  }

  const neighbours = rooms
    .filter((other) => !sameFace(other, room) && walls.some((wall) => walks(other, wall)))
    .map((other) => other.name)
    .filter((name) => name !== undefined)

  const objects = objectsIn(doc, level, room)

  return {
    ...(room.id === undefined ? {} : { id: room.id }),
    ...(room.name === undefined ? {} : { name: room.name }),
    ...(room.kind === undefined ? {} : { kind: room.kind }),
    areaM2: Math.round(room.area / 10_000) / 100,
    ...interiorSize(doc, level, room),
    box: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) },
    ...(room.floor === undefined ? {} : { floor: room.floor }),
    neighbours,
    walls: walls.flatMap((wall) => {
      const place = runOfWall(doc, level, room, wall.id)
      const a = doc.nodes[wall.a]
      const b = doc.nodes[wall.b]
      if (!place || !a || !b) return []
      return [
        {
          id: wall.id,
          side: place.side,
          ...(place.of > 1 ? { nth: place.nth } : {}),
          length: Math.round(Math.hypot(b.x - a.x, b.y - a.y)),
        },
      ]
    }),
    sides: SIDE_NAMES.flatMap((side) => {
      const runs = sideRuns(doc, level, room, side)
      return runs.map((run) => surveySide(doc, level, room, side, run, runs.length > 1, objects))
    }),
    openings,
    objects: objects.map((object) => surveyObject(doc, level, room, object)),
  }
}

/**
 * One run of a side, with what is on it and what is left.
 *
 * Openings and whatever backs onto it are projected onto the run as stretches
 * from its west or south end, and the gaps between them are what a new thing
 * can go in. The same arithmetic the placing does, said out loud — an agent
 * that can read the free stretches does not have to place by trial and refusal.
 */
export function surveySide(
  doc: HouseDocument,
  level: string,
  room: Room,
  side: Side,
  run: SideRun,
  numbered: boolean,
  among: HouseObject[] = objectsIn(doc, level, room),
): SideReport {
  const length = run.length || 1
  const unit = { x: (run.to.x - run.from.x) / length, y: (run.to.y - run.from.y) / length }
  const project = (point: Point) =>
    (point.x - run.from.x) * unit.x + (point.y - run.from.y) * unit.y

  // Each wall's own stretch of the run, so `--wall w12` can be placed along
  // without first working out where in the side that wall begins.
  const walls = run.walls.flatMap((wall) => {
    const stretch = stretchOf(run, wall.wall)
    return stretch === undefined
      ? []
      : [{ id: wall.wall, from: Math.round(stretch.from), to: Math.round(stretch.to) }]
  })
  const held = new Set(run.walls.map((wall) => wall.wall))
  const openings = Object.values(doc.openings)
    .filter((opening) => held.has(opening.wall))
    .sort((one, other) => order(one.id) - order(other.id))
    .flatMap((opening) => {
      const wall = doc.walls[opening.wall]
      const a = wall && doc.nodes[wall.a]
      const b = wall && doc.nodes[wall.b]
      if (!a || !b) return []
      const centre = project({ x: a.x + (b.x - a.x) * opening.t, y: a.y + (b.y - a.y) * opening.t })
      return [
        {
          id: opening.id,
          kind: opening.kind,
          from: Math.round(centre - opening.width / 2),
          to: Math.round(centre + opening.width / 2),
        },
      ]
    })

  // A thing says which side it backs onto and, where the side has several runs,
  // which of them; said nothing, it is on the longest — the one a bare --against
  // would have put it against.
  const longest = sideRun(doc, level, room, side)
  const objects = among
    .filter((object) => object.against === side && (object.againstNth ?? longest?.nth) === run.nth)
    .flatMap((object) => {
      const spot = standingAt(doc, level, room, object)
      if (!spot) return []
      const reach = footprintOf(spot, object).map(project)
      return [
        {
          id: object.id,
          type: object.type,
          from: Math.round(Math.min(...reach)),
          to: Math.round(Math.max(...reach)),
        },
      ]
    })

  const taken = [...openings, ...objects].map(({ from, to }) => ({ from, to }))
  return {
    side,
    ...(numbered ? { nth: run.nth } : {}),
    walls,
    length: run.length,
    thickness: run.thickness,
    openings,
    objects,
    free: freeSpans(run.length, taken).map((span) => ({
      from: Math.round(span.from),
      to: Math.round(span.to),
    })),
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
): ObjectReport {
  const spot = standingAt(doc, level, room, object)
  const run = object.against
    ? sideRun(doc, level, room, object.against, object.againstNth)
    : undefined
  const backing = run?.walls.reduce((best, next) =>
    Math.hypot(next.b.x - next.a.x, next.b.y - next.a.y) >
    Math.hypot(best.b.x - best.a.x, best.b.y - best.a.y)
      ? next
      : best,
  )
  return {
    id: object.id,
    type: object.type,
    ...(object.against === undefined ? {} : { against: object.against }),
    ...(backing === undefined ? {} : { wall: backing.wall }),
    along: object.along,
    ...(object.across === undefined ? {} : { across: object.across }),
    ...(object.rotation === undefined ? {} : { rotation: object.rotation }),
    ...(object.seats === undefined ? {} : { seats: object.seats }),
    width: object.width,
    depth: object.depth,
    surface: object.surface,
    ...(spot
      ? {
          at: { x: Math.round(spot.at.x), y: Math.round(spot.at.y) },
          clear: Object.fromEntries(
            objectClearances(doc, level, room, spot, object).map((it) => [it.side, it.length]),
          ),
        }
      : {}),
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
 * Where along a side an opening sits, as the fraction `--along` would put a
 * thing at the same place.
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
