import type { HouseDocument, Side } from '@houseit/core/document'
import { partsOf } from '@houseit/core/footprint'
import type { Point } from './outlines'
import type { Room } from './rooms'
import { sideRun } from './sides'

/** Where a thing was put: against a side of its room and how far along, or free. */
export type Standing = {
  against?: Side
  /** Which run of that side, where it has several; absent is the longest. */
  againstNth?: number
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
  rotation?: number
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

  const run = sideRun(doc, level, room, thing.against, thing.againstNth)
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
export const swingOf = (thing: { rotation?: number }) => ((thing.rotation ?? 0) * Math.PI) / 180

/**
 * What a thing takes up once it is turned: across the wall it stands at, and into
 * the room away from it.
 *
 * Its own width and depth while it faces square on, which is nearly always. Turned,
 * the two swap over by degrees, and both the stretch of wall it needs and how far
 * back it has to be set follow the turned shape rather than the shape it was cut to.
 */
export function reachOf(thing: { width: number; depth: number; rotation?: number }): {
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

/**
 * The boxes a thing really stands on, in plan millimetres.
 *
 * One for almost everything, and that one is its footprint. For a shape whose
 * box lies about where the floor is free — an L-shaped kitchen, a U-shaped run
 * — the parts its type declares, each turned and put where the thing is. What
 * is between them is floor, and something may stand there.
 */
export function piecesOf(
  spot: Spot,
  thing: { type: string; width: number; depth: number },
): Point[][] {
  const parts = partsOf(thing.type)
  if (parts.length === 1) return [footprintOf(spot, thing)]

  // The parts are fractions of the drawing, from its left edge and its top.
  const place = (x: number, y: number) =>
    onPlan(spot, thing, { x: x * thing.width, y: y * thing.depth })
  return parts.map((part) => [
    place(part.x0, part.y0),
    place(part.x1, part.y0),
    place(part.x1, part.y1),
    place(part.x0, part.y1),
  ])
}

/**
 * Where a point of a thing's drawing falls on the plan.
 *
 * The drawing's frame is the symbol's: x across from its left edge, y down
 * from its top, in the thing's own millimetres, and the top is the thing's
 * back. Laid on the plan the drawing is turned half round to put its back on
 * the wall, so with the thing facing north its left edge lies to the east —
 * the way a sofa whose chaise is on the right of its drawing has it on the
 * sitter's left. Everything that says where part of a thing is goes through
 * here, so the parts a click is tested against and the well a flight cuts
 * cannot be a mirror image of the thing as drawn, which they were.
 */
export function onPlan(spot: Spot, size: { width: number; depth: number }, point: Point): Point {
  const x = size.width / 2 - point.x
  const y = point.y - size.depth / 2
  const cos = Math.cos(spot.turn)
  const sin = Math.sin(spot.turn)
  return { x: spot.at.x + x * cos - y * sin, y: spot.at.y + x * sin + y * cos }
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
