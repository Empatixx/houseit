import type { HouseDocument, Side } from '@houseit/core/document'
import type { Point } from './outlines'
import type { Room } from './rooms'
import { sideRun } from './sides'

/** Where a thing was put: against a side of its room and how far along, or free. */
export type Standing = {
  against?: Side
  /** 0 at one end of that side, 1 at the other. */
  along: number
  /** Standing free: how far up the room, 0 south and 1 north. Absent is the middle. */
  across?: number
  width: number
  depth: number
  /**
   * A turn about its own middle, in degrees, on top of the way it already faces.
   *
   * Degrees because a plan is read by people and 45 is a thing somebody can say;
   * everything downstream of here works in radians. It changes what the thing
   * reaches into the room as well as which way it points, so the set-back has to
   * be worked out from the turned shape or half of an armchair set at an angle
   * stands inside the wall.
   */
  turn?: number
}

export type Spot = {
  /** Middle of the thing, in plan millimetres. */
  at: Point
  /** Which way it faces, in the plan's own sense. */
  turn: number
}

/**
 * Where a thing stands in a room, and which way it faces.
 *
 * The one place this is worked out. It was in the renderer alone once, which
 * meant the command that placed something and the drawing that showed it were
 * two separate opinions — and a check made against one of them says nothing
 * about the other.
 *
 * Against a wall it is set back by half its own depth and half the wall's, so its
 * back is on the face of the wall rather than inside it. Standing free it is
 * spread along the room's width, which is what keeps two chairs beside each other
 * instead of inside each other.
 */
export function standingAt(
  doc: HouseDocument,
  level: string,
  room: Room,
  thing: Standing,
): Spot | undefined {
  if (!thing.against) {
    const xs = room.nodes.map((node) => doc.nodes[node]?.x ?? 0)
    const ys = room.nodes.map((node) => doc.nodes[node]?.y ?? 0)
    const low = Math.min(...xs)
    const high = Math.max(...xs)
    const south = Math.min(...ys)
    const north = Math.max(...ys)
    return {
      at: {
        x: low + thing.along * (high - low),
        y: thing.across === undefined ? room.centre.y : south + thing.across * (north - south),
      },
      turn: swingOf(thing),
    }
  }

  const run = sideRun(doc, level, room, thing.against)
  if (!run) return undefined

  const unit = {
    x: (run.to.x - run.from.x) / (run.length || 1),
    y: (run.to.y - run.from.y) / (run.length || 1),
  }
  const travelled = thing.along * run.length
  const back = (run.thickness + reachOf(thing).into) / 2

  return {
    at: {
      x: run.from.x + unit.x * travelled + run.inward.x * back,
      y: run.from.y + unit.y * travelled + run.inward.y * back,
    },
    turn: Math.atan2(-run.inward.x, run.inward.y) + swingOf(thing),
  }
}

/** The turn a thing was given, in radians. Nothing at all, for almost everything. */
export const swingOf = (thing: { turn?: number }) => ((thing.turn ?? 0) * Math.PI) / 180

/**
 * What a thing takes up once it is turned: across the wall it stands at, and into
 * the room away from it.
 *
 * Its own width and depth while it faces square on, which is nearly always. Turned,
 * the two swap over by degrees, and both the stretch of wall it needs and how far
 * back it has to be set follow the turned shape rather than the shape it was cut to.
 */
export function reachOf(thing: { width: number; depth: number; turn?: number }): {
  across: number
  into: number
} {
  const swing = swingOf(thing)
  const square = Math.abs(Math.cos(swing))
  const skew = Math.abs(Math.sin(swing))

  return {
    across: thing.width * square + thing.depth * skew,
    into: thing.depth * square + thing.width * skew,
  }
}

/** The four corners a thing takes up on the floor, in plan millimetres. */
export function footprintOf(spot: Spot, size: { width: number; depth: number }): Point[] {
  const cos = Math.cos(spot.turn)
  const sin = Math.sin(spot.turn)
  const half = { x: size.width / 2, y: size.depth / 2 }

  return [
    [-half.x, -half.y],
    [half.x, -half.y],
    [half.x, half.y],
    [-half.x, half.y],
  ].map(([x, y]) => ({
    x: spot.at.x + x! * cos - y! * sin,
    y: spot.at.y + x! * sin + y! * cos,
  }))
}
