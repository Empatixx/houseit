import type { HouseDocument, Wall } from '@houseit/core/document'
import { wallBetween } from '@houseit/geometry/boundary'
import type { Axis } from '@houseit/geometry/cut'
import type { Point } from '@houseit/geometry/outlines'
import { containsPoint, type Room } from '@houseit/geometry/rooms'
import type { Draft } from 'immer'
import { allocateId } from './allocate-id'
import { CommandError } from './command-error'
import { splitWall } from './split-wall'

export const SNAP = 150

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

  const along = new Map<number, Point>()
  along.set(0, from)
  along.set(length, to)
  for (const node of nodesOn(draft, level)) {
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

export function nodeAtOrNew(draft: Draft<HouseDocument>, level: string, point: Point): string {
  const here = nodeHere(draft, level, point)
  if (here) return here
  const wall = wallUnder(draft, level, point)
  if (wall) return splitWall(draft, wall.id, { x: Math.round(point.x), y: Math.round(point.y) })
  const id = allocateId(draft.nodes, 'n')
  draft.nodes[id] = { id, x: Math.round(point.x), y: Math.round(point.y) }
  return id
}

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

function nodeHere(draft: Draft<HouseDocument>, level: string, point: Point): string | undefined {
  const at = Object.values(draft.nodes).filter((node) => node.x === point.x && node.y === point.y)
  if (at.length === 0) return undefined

  const walls = Object.values(draft.walls)
  const hanging = (id: string) => walls.filter((wall) => wall.a === id || wall.b === id)
  const onThisStorey = at.find((node) => hanging(node.id).some((wall) => wall.level === level))
  return (onThisStorey ?? at.find((node) => hanging(node.id).length === 0))?.id
}

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

export function nearWall(
  draft: Draft<HouseDocument>,
  level: string,
  point: Point,
): Point | undefined {
  for (const node of nodesOn(draft, level)) {
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

function nodesOn(draft: Draft<HouseDocument>, level: string) {
  const ids = new Set(
    Object.values(draft.walls)
      .filter((wall) => wall.level === level)
      .flatMap((wall) => [wall.a, wall.b]),
  )
  return Object.values(draft.nodes).filter((node) => ids.has(node.id))
}

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
