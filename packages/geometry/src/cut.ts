import type { HouseDocument } from '@houseit/core/document'
import { wallBetween } from './boundary'
import type { Point } from './outlines'
import type { Room } from './rooms'

export type Axis = 'x' | 'y'

export type Crossing = {
  /** Where the cut line meets the room's boundary. */
  point: Point
  /** The wall that has to be split there so the partition shares its ends. */
  wall: string
}

/**
 * Where an axis-aligned line crosses a room's boundary.
 *
 * This is the whole trick behind rooms that share a partition. A wall that only
 * looks like it touches another shares no node with it and divides nothing — the
 * graph is topological, not geometric. So before a partition can be inserted, the
 * walls at each end must be split at exactly these points.
 */
export function crossingsOf(
  doc: HouseDocument,
  level: string,
  room: Room,
  axis: Axis,
  at: number,
): Crossing[] {
  const across: Axis = axis === 'x' ? 'y' : 'x'
  const crossings: Crossing[] = []

  for (let i = 0; i < room.nodes.length; i += 1) {
    const from = doc.nodes[room.nodes[i]!]
    const to = doc.nodes[room.nodes[(i + 1) % room.nodes.length]!]
    if (!from || !to) continue

    // A line lying along an edge is not a crossing: it would split nothing and
    // leave a zero-length wall behind.
    const straddles = from[axis] < at !== to[axis] < at && from[axis] !== to[axis]
    if (!straddles) continue

    const ratio = (at - from[axis]) / (to[axis] - from[axis])
    const other = Math.round(from[across] + ratio * (to[across] - from[across]))
    const point = (axis === 'x' ? { x: at, y: other } : { x: other, y: at }) as Point

    const wall = wallBetween(doc, level, room.nodes[i]!, room.nodes[(i + 1) % room.nodes.length]!)
    if (wall) crossings.push({ point, wall: wall.id })
  }

  return crossings
}

/**
 * Whether everything a cut would take off sits against one straight edge.
 *
 * Two crossings are not enough to promise a rectangle. Cut the north off an
 * L-shaped floor and the line still meets the boundary exactly twice, but the
 * notch leaves a shallow tail running along under it. That tail shows up here as
 * a corner beyond the cut line that does not sit on the far edge.
 */
export function sideIsStraight(
  doc: HouseDocument,
  room: Room,
  axis: Axis,
  at: number,
  far: number,
): boolean {
  return room.nodes.every((id) => {
    const point = doc.nodes[id]
    if (!point) return true
    const beyond = far > at ? point[axis] > at : point[axis] < at
    return !beyond || point[axis] === far
  })
}
