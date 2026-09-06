import type { HouseDocument, HouseObject } from '@houseit/core/document'
import { levelBelow } from '@houseit/core/levels'
import {
  coveredTreads,
  flightWidthOf,
  isStaircase,
  type StairShape,
  stairKind,
  stairShape,
  treadsOf,
} from '@houseit/core/stairs'
import { centroidOf } from './centroid'
import type { Point } from './outlines'
import { containsPoint, type Room, roomsOf } from './rooms'
import { onPlan, standingAt } from './standing'
import { unionOfBoxes } from './union'

/**
 * The holes a staircase makes in the floor above it.
 *
 * A flight of stairs is not furniture standing in a room: it is a way out of
 * the room, upwards, and the floor overhead has to be missing where it comes
 * through or the top of it meets a ceiling. So the well is not a thing anybody
 * draws or stores — it is the staircase itself, seen from the storey above.
 *
 * Derived rather than written down, which is the same reason rooms are: two
 * records of one hole is one record too many, and the second is the one that
 * ends up wrong.
 */
export type Well = {
  /** The staircase it belongs to, on the storey below. */
  object: string
  type: string
  /** The hole, in plan millimetres, corners in order round it. */
  outline: Point[]
}

/** Every staircase on a storey, with the hole it needs in the floor above. */
export function stairwaysOn(doc: HouseDocument, level: string): Well[] {
  const storey = doc.levels[level]
  if (!storey) return []
  const rooms = new Map(
    roomsOf(doc, level)
      .filter((room) => room.id)
      .map((room) => [room.id!, room] as const),
  )

  return Object.values(doc.objects).flatMap((object: HouseObject) => {
    const kind = stairKind(object.type)
    if (object.level !== level || !kind || !isStaircase(object.type)) return []
    const room = rooms.get(object.room)
    const spot = room ? standingAt(doc, level, room, object) : undefined
    if (!spot) return []
    const shape = stairShape(kind, storey.height, flightWidthOf(kind, object.width, storey.height))
    const outline = wellOf(shape).map((point) => onPlan(spot, object, point))
    return [{ object: object.id, type: object.type, outline }]
  })
}

/** How many straight pieces a spiral's round well is drawn in. */
const ROUND = 24

/**
 * The hole a flight needs in the floor above, on its own footprint.
 *
 * Not the whole footprint: over the first treads there is a storey of air less
 * the slab, and while that is still the headroom somebody needs the floor
 * above stays. The well is the treads without it, taken together — for a
 * straight flight the top of the run, for an L the arm away and the top of the
 * arm up. A spiral's is the circle it turns in, because a spiral has no foot
 * anybody could stand a floor over.
 */
export function wellOf(shape: StairShape): Point[] {
  if (shape.kind === 'spiral') {
    const radius = shape.size.width / 2
    return Array.from({ length: ROUND }, (_, index) => {
      const angle = (index / ROUND) * Math.PI * 2
      return { x: radius + Math.cos(angle) * radius, y: radius + Math.sin(angle) * radius }
    })
  }
  const covered = coveredTreads(shape)
  const boxes = treadsOf(shape)
    .filter((tread) => tread.step > covered)
    .map((tread) => {
      const xs = tread.outline.map((point) => point.x)
      const ys = tread.outline.map((point) => point.y)
      return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
    })
  return unionOfBoxes(boxes)[0] ?? []
}

/**
 * The holes in this storey's floor: the staircases on the storey underneath,
 * coming up through it. Nothing on the lowest floor, which stands on the ground.
 */
export function wellsIn(doc: HouseDocument, level: string): Well[] {
  const under = levelBelow(doc, level)
  return under ? stairwaysOn(doc, under.id) : []
}

/**
 * The holes in one room's floor.
 *
 * The one place that decides what of a well belongs to a room, so the floor
 * drawn with a hole in it and the room that says it has one can never disagree
 * — which is how a hole came to be reported and not drawn. A well that comes
 * up under a wall is cut along it, and each room gets its own part: the wall
 * is what is wrong there, and the checks say so, but a hole that reaches out
 * of the room it is cut from cannot be cut at all.
 */
export function wellsInRoom(doc: HouseDocument, level: string, room: Room): Well[] {
  const outline = room.nodes.map((id) => doc.nodes[id]).filter((node) => node !== undefined)
  const wells = wellsIn(doc, level)
  return holesIn(
    outline,
    wells.map((well) => well.outline),
  ).map((hole) => ({ ...wells[hole.index]!, outline: hole.outline }))
}

/**
 * Which of these holes fall in a room, and what of each does: the part inside,
 * kept a hair in from the walls, or the whole of it where it is wholly inside.
 */
export function holesIn(room: Point[], holes: Point[][]): { index: number; outline: Point[] }[] {
  if (room.length < 3) return []
  return holes.flatMap((hole, index) => {
    const cut = pierce(room, hole)
    return cut ? [{ index, outline: cut }] : []
  })
}

/** How far in from a wall's middle line a hole stops, so the floor can be cut round it. */
const HAIR = 20
/** A hole smaller than this is the edge of one and not a hole: a sliver a wall left. */
const LEAST = 100_000

/** The part of a hole that lies in a room, or nothing where none of it does. */
function pierce(room: Point[], hole: Point[]): Point[] | undefined {
  const inward = Math.sign(areaOf(room)) || 1
  let cut = hole
  for (let index = 0; index < room.length; index += 1) {
    const a = room[index]!
    const b = room[(index + 1) % room.length]!
    if (a.x === b.x && a.y === b.y) continue
    // Only a wall the hole actually reaches across cuts it. Cutting by every
    // wall's line would take a bite out of a hole in an L-shaped room, where a
    // wall's line runs on across the room after the wall itself has stopped.
    const depths = cut.map((point) => inward * across(a, b, point))
    const straddles = depths.some((depth) => depth > 1) && depths.some((depth) => depth < -1)
    if (!straddles || !meets(a, b, cut)) continue
    cut = clipped(cut, a, b, inward)
    if (cut.length < 3) return undefined
  }
  const area = areaOf(cut)
  if (Math.abs(area) < LEAST) return undefined
  const middle = centroidOf(cut, area)
  return containsPoint(room, middle.x, middle.y) ? cut : undefined
}

/** How far a point lies to the left of the line from a to b, in millimetres. */
function across(a: Point, b: Point, point: Point): number {
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  return ((b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x)) / length
}

/** The polygon cut along the line through a and b, keeping the inward side, a hair in. */
function clipped(polygon: Point[], a: Point, b: Point, inward: number): Point[] {
  const kept: Point[] = []
  for (let index = 0; index < polygon.length; index += 1) {
    const here = polygon[index]!
    const before = polygon[(index + polygon.length - 1) % polygon.length]!
    const hereIn = inward * across(a, b, here) - HAIR
    const beforeIn = inward * across(a, b, before) - HAIR
    if (hereIn >= 0) {
      if (beforeIn < 0) kept.push(between(before, here, beforeIn, hereIn))
      kept.push(here)
    } else if (beforeIn >= 0) {
      kept.push(between(before, here, beforeIn, hereIn))
    }
  }
  return kept
}

/** Where the segment from one point to the other crosses the line, given how far in each is. */
function between(from: Point, to: Point, fromIn: number, toIn: number): Point {
  const t = fromIn / (fromIn - toIn)
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
}

/** Whether the wall from a to b touches the polygon at all. */
function meets(a: Point, b: Point, polygon: Point[]): boolean {
  if (containsPoint(polygon, a.x, a.y) || containsPoint(polygon, b.x, b.y)) return true
  return polygon.some((point, index) => {
    const next = polygon[(index + 1) % polygon.length]!
    return crosses(a, b, point, next)
  })
}

/** Whether two segments cross, ends included. */
function crosses(a: Point, b: Point, c: Point, d: Point): boolean {
  const turn = (p: Point, q: Point, r: Point) =>
    Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x))
  const one = turn(a, b, c)
  const two = turn(a, b, d)
  const three = turn(c, d, a)
  const four = turn(c, d, b)
  if (one !== two && three !== four) return true
  const on = (p: Point, q: Point, r: Point) =>
    turn(p, q, r) === 0 &&
    Math.min(p.x, q.x) <= r.x &&
    r.x <= Math.max(p.x, q.x) &&
    Math.min(p.y, q.y) <= r.y &&
    r.y <= Math.max(p.y, q.y)
  return on(a, b, c) || on(a, b, d) || on(c, d, a) || on(c, d, b)
}

/** Signed shoelace area: positive with y up and the corners anticlockwise. */
function areaOf(polygon: Point[]): number {
  let total = 0
  for (let index = 0; index < polygon.length; index += 1) {
    const here = polygon[index]!
    const next = polygon[(index + 1) % polygon.length]!
    total += here.x * next.y - next.x * here.y
  }
  return total / 2
}
