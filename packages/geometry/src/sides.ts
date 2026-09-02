import type { HouseDocument, Side } from '@houseit/core/document'
import { boundaryWallsOf } from './boundary'
import type { Point } from './outlines'
import type { Room } from './rooms'

/** The coordinate a wall on that side holds constant, and which end of it to take. */
export const SIDES = {
  west: { axis: 'x', low: true },
  east: { axis: 'x', low: false },
  south: { axis: 'y', low: true },
  north: { axis: 'y', low: false },
} as const satisfies Record<Side, { axis: 'x' | 'y'; low: boolean }>

export type SideWall = { wall: string; a: Point; b: Point }

/**
 * The wall on one side of a room: the one lying along that side at the very edge
 * of the room, and the longest of those if a stepped room offers more than one.
 *
 * It has to be at the room's own edge, not merely the outermost wall that happens
 * to run that way. A triangular room has a wall running east to west, but it is
 * the south wall — asked for the north one, the honest answer is that there is
 * none, not the south wall handed over quietly.
 */
export function wallOnSide(
  doc: HouseDocument,
  level: string,
  room: Room,
  side: Side,
): SideWall | undefined {
  const candidates = wallsOnSide(doc, level, room, side)
  if (candidates.length === 0) return undefined
  return candidates.reduce((best, next) => (lengthOf(next) > lengthOf(best) ? next : best))
}

/**
 * Every wall along one side of a room, not just the longest.
 *
 * A side is one wall until something splits it — a room cut off the far end of it
 * leaves two, and which of them matters depends on where you are standing. Asking
 * for the longest is right when you want the side; asking for all of them is right
 * when you want the one under a particular point.
 */
export function wallsOnSide(doc: HouseDocument, level: string, room: Room, side: Side): SideWall[] {
  const { axis, low } = SIDES[side]
  const corners = room.nodes.map((node) => doc.nodes[node]).filter((node) => node !== undefined)
  if (corners.length === 0) return []

  const reach = corners.map((corner) => corner[axis])
  const edge = low ? Math.min(...reach) : Math.max(...reach)

  return boundaryWallsOf(doc, level, room)
    .map((wall) => ({ wall: wall.id, a: doc.nodes[wall.a]!, b: doc.nodes[wall.b]! }))
    .filter(({ a, b }) => a && b && a[axis] === b[axis] && a[axis] === edge)
}

export type SideRun = {
  /** The two ends of the side, ordered so that 0 is always the same end. */
  from: Point
  to: Point
  length: number
  /** Which way the room lies from the wall, as a unit step in plan coordinates. */
  inward: Point
  /**
   * The wall's own thickness. A run is its centre line, not its face, so anything
   * put against it has to clear half of this or it stands inside the masonry.
   */
  thickness: number
}

/**
 * The line something placed against a side is placed along.
 *
 * Ordered west to east, or south to north, so a fraction along it means the same
 * thing every time it is read — a sofa a third of the way along the south wall
 * stays a third of the way along it when that wall is later split in two.
 */
export function sideRun(
  doc: HouseDocument,
  level: string,
  room: Room,
  side: Side,
): SideRun | undefined {
  const walls = wallsOnSide(doc, level, room, side)
  if (walls.length === 0) return undefined

  // Every wall along the side, not the longest of them. A partition landing on
  // the far side of a hall cuts that wall in two without cutting the hall in two,
  // and a side taken as one of the halves is a five-metre wall that will not take
  // a three-metre staircase.
  const along: 'x' | 'y' = SIDES[side].axis === 'x' ? 'y' : 'x'
  const reach = walls.flatMap(({ a, b }) => [a, b])
  const [end, far] = [
    reach.reduce((low, next) => (next[along] < low[along] ? next : low)),
    reach.reduce((high, next) => (next[along] > high[along] ? next : high)),
  ]
  const found = walls.reduce((best, next) => (lengthOf(next) > lengthOf(best) ? next : best))
  const step = SIDES[side].low ? 1 : -1

  // A corner is the middle of the wall turning it, so the run has to stop at that
  // wall's face and not at its centre line. Left at the centre lines, everything
  // spread along the side has its ends buried in the masonry either side of it —
  // which is exactly where the bedside table ended up.
  const near = crossingHalf(doc, level, room, found.wall, end)
  const beyond = crossingHalf(doc, level, room, found.wall, far)
  const way = { x: Math.sign(far.x - end.x), y: Math.sign(far.y - end.y) }
  const from = { x: end.x + way.x * near, y: end.y + way.y * near }
  const to = { x: far.x - way.x * beyond, y: far.y - way.y * beyond }

  return {
    from,
    to,
    length: Math.round(Math.hypot(to.x - from.x, to.y - from.y)),
    inward: SIDES[side].axis === 'x' ? { x: step, y: 0 } : { x: 0, y: step },
    thickness: doc.walls[found.wall]?.thickness ?? 0,
  }
}

/** Half the thickness of the thickest wall of the room turning that corner. */
function crossingHalf(
  doc: HouseDocument,
  level: string,
  room: Room,
  wall: string,
  corner: Point,
): number {
  const thickest = boundaryWallsOf(doc, level, room)
    .filter((other) => other.id !== wall)
    .filter((other) =>
      [doc.nodes[other.a], doc.nodes[other.b]].some(
        (node) => node && node.x === corner.x && node.y === corner.y,
      ),
    )
    .reduce((most, other) => Math.max(most, other.thickness), 0)

  return thickest / 2
}

const lengthOf = ({ a, b }: SideWall) => Math.round(Math.hypot(b.x - a.x, b.y - a.y))

/**
 * Which side of a room a wall of it lies on, read off the way the room's face
 * walks it: faces run counter-clockwise, so the room is on the left of every
 * edge, and a wall with the room lying south of it is the north wall. Nothing
 * for a wall the room does not walk.
 */
export function sideOfWall(
  doc: HouseDocument,
  level: string,
  room: Room,
  wallId: string,
): Side | undefined {
  const wall = doc.walls[wallId]
  if (!wall || wall.level !== level) return undefined
  const count = room.nodes.length

  for (let i = 0; i < count; i += 1) {
    const aId = room.nodes[i]!
    const bId = room.nodes[(i + 1) % count]!
    const walked = (wall.a === aId && wall.b === bId) || (wall.a === bId && wall.b === aId)
    if (!walked) continue
    const a = doc.nodes[aId]
    const b = doc.nodes[bId]
    if (!a || !b) continue
    return sideFacing({ x: -(b.y - a.y), y: b.x - a.x })
  }
  return undefined
}

/** The side a wall is on, from the way it faces into its room: facing south, it is the north wall. */
export function sideFacing(inward: Point): Side {
  if (Math.abs(inward.y) >= Math.abs(inward.x)) return inward.y < 0 ? 'north' : 'south'
  return inward.x < 0 ? 'east' : 'west'
}
