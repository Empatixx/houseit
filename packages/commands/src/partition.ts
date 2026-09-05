import type { HouseDocument, Wall } from '@houseit/core/document'
import { wallBetween } from '@houseit/geometry/boundary'
import type { Axis } from '@houseit/geometry/cut'
import type { Point } from '@houseit/geometry/outlines'
import { containsPoint, type Room } from '@houseit/geometry/rooms'
import type { Draft } from 'immer'
import { allocateId } from './allocate-id'
import { CommandError } from './command-error'
import { splitWall } from './split-wall'

/**
 * Putting a straight wall into a room.
 *
 * The graph is topological: a wall that only looks as if it touches another
 * shares no node with it and divides nothing. So every end of a new wall has
 * to land on a node — an existing one, or one split out of the wall it meets
 * — and that is what everything here is about. A line across a room that
 * steps in and out meets its boundary more than twice; each stretch of the
 * line that lies inside the room becomes a wall of its own, and a stretch
 * that already has a wall along it is left as it is.
 */

/** How near a wall or a node the end of a wall may be let go and still be joined to it. */
export const SNAP = 150

/**
 * Cuts a room right across, along the line `axis = at`, and returns the walls
 * made. One wall for a rectangle; more where the room steps, so the cut goes
 * round the step rather than through it or into thin air.
 */
export function partitionAlong(
  draft: Draft<HouseDocument>,
  level: string,
  room: Room,
  axis: Axis,
  at: number,
  thickness: number,
  what: string,
): string[] {
  const across: Axis = axis === 'x' ? 'y' : 'x'
  const polygon = room.nodes.map((id) => draft.nodes[id]).filter((node) => node !== undefined)

  // Where the line meets the boundary: through a wall, or at a node sitting on it.
  const hits = new Map<number, Point>()
  const count = room.nodes.length
  for (let i = 0; i < count; i += 1) {
    const a = draft.nodes[room.nodes[i]!]
    const b = draft.nodes[room.nodes[(i + 1) % count]!]
    if (!a || !b) continue
    if (a[axis] === at) hits.set(a[across], { x: a.x, y: a.y })
    if (b[axis] === at) hits.set(b[across], { x: b.x, y: b.y })
    const straddles = a[axis] < at !== b[axis] < at && a[axis] !== at && b[axis] !== at
    if (straddles) {
      const ratio = (at - a[axis]) / (b[axis] - a[axis])
      const other = Math.round(a[across] + ratio * (b[across] - a[across]))
      hits.set(other, axis === 'x' ? { x: at, y: other } : { x: other, y: at })
    }
  }
  const points = [...hits.values()].sort((one, other) => one[across] - other[across])

  const made: string[] = []
  for (let i = 0; i + 1 < points.length; i += 1) {
    const from = points[i]!
    const to = points[i + 1]!
    const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
    // Only a stretch inside the room, and not one that is a wall already.
    if (wallUnder(draft, level, middle)) continue
    if (!containsPoint(polygon, middle.x, middle.y)) continue
    const start = nodeAt(draft, level, from, what)
    const end = nodeAt(draft, level, to, what)
    if (start === end || wallBetween(draft, level, start, end)) continue
    made.push(join(draft, level, start, end, thickness))
  }

  if (made.length === 0) throw new CommandError(`${what}: a wall there would cut nothing`)
  return made
}

/**
 * A wall from a point on a room's boundary into the room: as far as `length`,
 * or if none is given until it meets the far wall. An end let go within reach
 * of a wall or a node is joined to it; otherwise it stands free, which is a
 * wall stub and makes a nook rather than a room.
 */
export function wallInto(
  draft: Draft<HouseDocument>,
  level: string,
  room: Room,
  from: Point,
  direction: Point,
  length: number | undefined,
  thickness: number,
  what: string,
): string {
  const polygon = room.nodes.map((id) => draft.nodes[id]).filter((node) => node !== undefined)
  const start = nodeAt(draft, level, from, what)

  let end: string
  if (length === undefined) {
    const hit = firstWallAlong(draft, room, from, direction)
    if (!hit) throw new CommandError(`${what}: nothing across the room for the wall to reach`)
    end = nodeAt(draft, level, hit, what)
  } else {
    const to = { x: from.x + direction.x * length, y: from.y + direction.y * length }
    const near = nearWall(draft, level, to)
    if (near) {
      end = nodeAt(draft, level, near, what)
    } else {
      if (!containsPoint(polygon, to.x, to.y)) {
        throw new CommandError(`${what}: ${length} mm runs out of ${room.name ?? 'the room'}`)
      }
      end = allocateId(draft.nodes, 'n')
      draft.nodes[end] = { id: end, x: Math.round(to.x), y: Math.round(to.y) }
    }
  }

  if (start === end) throw new CommandError(`${what}: a wall from a point to itself is no wall`)
  if (wallBetween(draft, level, start, end)) {
    throw new CommandError(`${what}: there is a wall there already`)
  }
  return join(draft, level, start, end, thickness)
}

/**
 * A wall along a straight line between two points, wherever they are: on a
 * wall, at a node, or out in the open. Every wall the line crosses and every
 * node it passes through becomes a joint, so a line drawn across two rooms
 * is a partition in each, meeting the walls between as a T. Stretches that
 * already have a wall along them are left as they are. An end that is not
 * on anything stands free.
 */
export function linkPoints(
  draft: Draft<HouseDocument>,
  level: string,
  from: Point,
  to: Point,
  thickness: number,
  what: string,
): string[] {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return []
  const unit = { x: dx / length, y: dy / length }

  // Where along the line something is already: a node on it, or a wall across it.
  const along = new Map<number, Point>()
  along.set(0, from)
  along.set(length, to)
  for (const node of Object.values(draft.nodes)) {
    const t = (node.x - from.x) * unit.x + (node.y - from.y) * unit.y
    const off = Math.abs((node.x - from.x) * unit.y - (node.y - from.y) * unit.x)
    if (t > 0.5 && t < length - 0.5 && off < 0.5) along.set(Math.round(t), { x: node.x, y: node.y })
  }
  for (const wall of Object.values(draft.walls)) {
    if (wall.level !== level) continue
    const a = draft.nodes[wall.a]
    const b = draft.nodes[wall.b]
    if (!a || !b) continue
    const edge = { x: b.x - a.x, y: b.y - a.y }
    const denominator = unit.x * edge.y - unit.y * edge.x
    if (Math.abs(denominator) < 1e-9) continue
    const gap = { x: a.x - from.x, y: a.y - from.y }
    const t = (gap.x * edge.y - gap.y * edge.x) / denominator
    const u = (gap.x * unit.y - gap.y * unit.x) / denominator
    if (u <= 0 || u >= 1 || t <= 0.5 || t >= length - 0.5) continue
    along.set(Math.round(t), {
      x: Math.round(from.x + unit.x * t),
      y: Math.round(from.y + unit.y * t),
    })
  }

  const stops = [...along.entries()].sort((one, other) => one[0] - other[0]).map(([, p]) => p)
  const made: string[] = []
  for (let i = 0; i + 1 < stops.length; i += 1) {
    const start = nodeAtOrNew(draft, level, stops[i]!)
    const end = nodeAtOrNew(draft, level, stops[i + 1]!)
    if (start === end || wallBetween(draft, level, start, end)) continue
    const middle = {
      x: (stops[i]!.x + stops[i + 1]!.x) / 2,
      y: (stops[i]!.y + stops[i + 1]!.y) / 2,
    }
    if (wallUnder(draft, level, middle)) continue
    made.push(join(draft, level, start, end, thickness))
  }
  if (made.length === 0) throw new CommandError(`${what}: there is a wall there already`)
  return made
}

/** The node at a point, split out of a wall if one is there, or new if nothing is. */
export function nodeAtOrNew(draft: Draft<HouseDocument>, level: string, point: Point): string {
  const here = nodeHere(draft, level, point)
  if (here) return here
  const wall = wallUnder(draft, level, point)
  if (wall) return splitWall(draft, wall.id, { x: Math.round(point.x), y: Math.round(point.y) })
  const id = allocateId(draft.nodes, 'n')
  draft.nodes[id] = { id, x: Math.round(point.x), y: Math.round(point.y) }
  return id
}

/** The node at a point: one already there, or one split out of the wall under it. */
export function nodeAt(
  draft: Draft<HouseDocument>,
  level: string,
  point: Point,
  what: string,
): string {
  const here = nodeHere(draft, level, point)
  if (here) return here
  const wall = wallUnder(draft, level, point)
  if (!wall) throw new CommandError(`${what}: nothing at ${point.x},${point.y} for a wall to meet`)
  return splitWall(draft, wall.id, { x: Math.round(point.x), y: Math.round(point.y) })
}

/**
 * The node at a point that this storey's walls hang off.
 *
 * A node carries no storey of its own — walls do — so a house of two floors
 * built on the same footprint has two nodes at every corner, one per storey.
 * Taking whichever came first attaches the upper floor's walls to the ground
 * floor's corners, and then neither storey's walls close a room: the graph is
 * one tangle wearing two floors.
 *
 * So: a node already carrying a wall on this storey, or one carrying no walls
 * at all, and otherwise none — let the caller make a fresh one.
 */
function nodeHere(draft: Draft<HouseDocument>, level: string, point: Point): string | undefined {
  const at = Object.values(draft.nodes).filter((node) => node.x === point.x && node.y === point.y)
  if (at.length === 0) return undefined

  const walls = Object.values(draft.walls)
  const hanging = (id: string) => walls.filter((wall) => wall.a === id || wall.b === id)
  const onThisStorey = at.find((node) => hanging(node.id).some((wall) => wall.level === level))
  return (onThisStorey ?? at.find((node) => hanging(node.id).length === 0))?.id
}

/** The wall a point lies on, if any does. */
export function wallUnder(
  draft: Draft<HouseDocument>,
  level: string,
  point: Point,
): Wall | undefined {
  return Object.values(draft.walls).find((wall) => {
    if (wall.level !== level) return false
    const a = draft.nodes[wall.a]
    const b = draft.nodes[wall.b]
    if (!a || !b) return false
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x)
    if (Math.abs(cross) > 0.5 * Math.hypot(b.x - a.x, b.y - a.y)) return false
    const dot = (point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)
    return dot >= 0 && dot <= (b.x - a.x) ** 2 + (b.y - a.y) ** 2
  }) as Wall | undefined
}

/** A point on the nearest wall or node within reach of a point, or nothing. */
export function nearWall(
  draft: Draft<HouseDocument>,
  level: string,
  point: Point,
): Point | undefined {
  for (const node of Object.values(draft.nodes)) {
    if (Math.hypot(node.x - point.x, node.y - point.y) <= SNAP) return { x: node.x, y: node.y }
  }
  let best: { point: Point; distance: number } | undefined
  for (const wall of Object.values(draft.walls)) {
    if (wall.level !== level) continue
    const a = draft.nodes[wall.a]
    const b = draft.nodes[wall.b]
    if (!a || !b) continue
    const lengthSquared = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
    if (lengthSquared === 0) continue
    const t = ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / lengthSquared
    if (t < 0 || t > 1) continue
    const foot = { x: Math.round(a.x + (b.x - a.x) * t), y: Math.round(a.y + (b.y - a.y) * t) }
    const distance = Math.hypot(foot.x - point.x, foot.y - point.y)
    if (distance <= SNAP && (!best || distance < best.distance)) best = { point: foot, distance }
  }
  return best?.point
}

/** Where a ray from a point on the boundary first meets the boundary again. */
function firstWallAlong(
  draft: Draft<HouseDocument>,
  room: Room,
  from: Point,
  direction: Point,
): Point | undefined {
  let best: { t: number; point: Point } | undefined
  const count = room.nodes.length
  for (let i = 0; i < count; i += 1) {
    const a = draft.nodes[room.nodes[i]!]
    const b = draft.nodes[room.nodes[(i + 1) % count]!]
    if (!a || !b) continue
    const edge = { x: b.x - a.x, y: b.y - a.y }
    const denominator = direction.x * edge.y - direction.y * edge.x
    if (Math.abs(denominator) < 1e-9) continue
    const gap = { x: a.x - from.x, y: a.y - from.y }
    const t = (gap.x * edge.y - gap.y * edge.x) / denominator
    const u = (gap.x * direction.y - gap.y * direction.x) / denominator
    if (u < 0 || u > 1 || t <= 1) continue
    if (!best || t < best.t) {
      best = {
        t,
        point: { x: Math.round(from.x + direction.x * t), y: Math.round(from.y + direction.y * t) },
      }
    }
  }
  return best?.point
}

function join(draft: Draft<HouseDocument>, level: string, a: string, b: string, thickness: number) {
  const id = allocateId(draft.walls, 'w')
  draft.walls[id] = {
    id,
    level,
    a,
    b,
    thickness,
    baseOffset: 0,
    height: draft.levels[level]?.height ?? 2800,
  }
  return id
}
