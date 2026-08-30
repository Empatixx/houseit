import type { HouseDocument, Side } from '@houseit/core/document'
import type { Room } from '@houseit/geometry/rooms'
import { wallsOnSide } from '@houseit/geometry/sides'
import { allocateId } from './allocate-id'
import { CommandError } from './command-error'
import { splitWall } from './split-wall'

export const CORNERS = {
  'north-west': { west: true, north: true },
  'north-east': { west: false, north: true },
  'south-west': { west: true, north: false },
  'south-east': { west: false, north: false },
} as const

export type Corner = keyof typeof CORNERS

export type Cut = {
  /** Where to anchor the room being cut out, and where to move the old one to. */
  taken: { x: number; y: number }
  left: { x: number; y: number }
}

/**
 * Takes a rectangle out of one corner of a room, leaving the rest of it L-shaped.
 *
 * This is the second way a room comes into being, and the one that makes a plan
 * stop looking like a row of stripes. Where a side cut is one partition between
 * two walls, a corner cut is two meeting at a new node — which is exactly why the
 * remainder comes out with six corners instead of four.
 *
 * What it refuses is a corner that is not there: each end of the new partition has
 * to land on a wall the room actually has, at a point that wall actually reaches.
 * Cut the same corner twice and the second cut would hang in open air — but the
 * other three corners of an L are still corners, and taking one is fine.
 */
export function cutCorner(
  draft: HouseDocument,
  level: string,
  room: Room,
  corner: Corner,
  size: {
    width: number
    depth: number
    thickness: number
    /** A bite out of the new room's inner corner, which makes it L-shaped. */
    notch?: { width: number; depth: number }
  },
): Cut {
  const points = room.nodes.map((node) => draft.nodes[node]!).filter((point) => point)
  const x0 = Math.min(...points.map((point) => point.x))
  const x1 = Math.max(...points.map((point) => point.x))
  const y0 = Math.min(...points.map((point) => point.y))
  const y1 = Math.max(...points.map((point) => point.y))

  if (size.width >= x1 - x0) {
    throw new CommandError(`add-room: wider than ${room.name}, which is ${x1 - x0} mm across`)
  }
  if (size.depth >= y1 - y0) {
    throw new CommandError(
      `add-room: deeper than ${room.name}, which is ${y1 - y0} mm front to back`,
    )
  }
  const notch = size.notch ?? { width: 0, depth: 0 }
  if (notch.width >= size.width || notch.depth >= size.depth) {
    throw new CommandError('add-room: the notch is bigger than the room it is taken out of')
  }

  const { west, north } = CORNERS[corner]
  const sx = west ? 1 : -1
  const sy = north ? -1 : 1
  const edgeX = west ? x0 : x1
  const edgeY = north ? y1 : y0
  const at = (across: number, into: number) => ({ x: edgeX + sx * across, y: edgeY + sy * into })

  const meets = at(size.width, 0)
  const turns = at(0, size.depth)

  // The wall the partition lands on, not merely the longest one on that side: a
  // side already cut into is several walls, and only one of them is under the point.
  const wallAcross = under(draft, level, room, north ? 'north' : 'south', meets)
  const wallAlong = under(draft, level, room, west ? 'west' : 'east', turns)
  if (!wallAcross || !wallAlong) {
    throw new CommandError(
      `add-room: ${room.name} has no ${corner} corner left to take — that side has already been cut back`,
    )
  }

  // The partition walks from one wall round to the other, going round the notch
  // if there is one. With no notch the inner points fall together and the walk is
  // the plain elbow a rectangular corner needs.
  const path = [
    meets,
    at(size.width, size.depth - notch.depth),
    at(size.width - notch.width, size.depth - notch.depth),
    at(size.width - notch.width, size.depth),
    turns,
  ]

  const ends = [
    splitWall(draft, wallAcross.wall, meets),
    ...path.slice(1, -1).map((point) => node(draft, point)),
    splitWall(draft, wallAlong.wall, turns),
  ]

  for (let i = 0; i < ends.length - 1; i += 1) {
    if (ends[i] === ends[i + 1]) continue
    const id = allocateId(draft.walls, 'w')
    draft.walls[id] = {
      id,
      level,
      a: ends[i]!,
      b: ends[i + 1]!,
      thickness: size.thickness,
      baseOffset: 0,
      height: draft.levels[level]!.height,
    }
  }

  return {
    // The leg beside the notch runs the room's whole depth, so its middle is
    // inside whether the room came out a rectangle or an L.
    taken: at((size.width - notch.width) / 2, size.depth / 2),
    // The far strip runs the room's whole depth, so a point in the middle of it is
    // inside the L wherever the corner was taken from.
    left: {
      x: Math.round((edgeX + sx * size.width + (west ? x1 : x0)) / 2),
      y: Math.round((y0 + y1) / 2),
    },
  }
}

/** The wall on that side of the room that runs through the point, if any does. */
function under(
  draft: HouseDocument,
  level: string,
  room: Room,
  side: Side,
  point: { x: number; y: number },
) {
  const between = (value: number, one: number, other: number) =>
    value >= Math.min(one, other) && value <= Math.max(one, other)

  return wallsOnSide(draft, level, room, side).find(
    ({ a, b }) => between(point.x, a.x, b.x) && between(point.y, a.y, b.y),
  )
}

/** A point on the plan, reused if the walk has already been through it. */
function node(draft: HouseDocument, point: { x: number; y: number }): string {
  const already = Object.values(draft.nodes).find(
    (candidate) => candidate.x === point.x && candidate.y === point.y,
  )
  if (already) return already.id

  const id = allocateId(draft.nodes, 'n')
  draft.nodes[id] = { id, x: point.x, y: point.y }
  return id
}
