import type { HouseDocument, Side } from '@houseit/core/document'
import { wallBetween } from './boundary'
import type { Point } from './outlines'
import type { Room } from './rooms'
import { wallsOnSide } from './sides'
import { footprintOf, type Spot } from './standing'

export type Dimension = {
  from: Point
  to: Point
  length: number
  offset: Point
}

export const STANDOFF = 300

export function roomDimensions(doc: HouseDocument, level: string, room: Room): Dimension[] {
  const count = room.nodes.length
  if (count < 3) return []
  const seen = new Set<string>()
  const dimensions: Dimension[] = []

  for (let i = 0; i < count; i += 1) {
    const aId = room.nodes[i]!
    const bId = room.nodes[(i + 1) % count]!
    const a = doc.nodes[aId]
    const b = doc.nodes[bId]
    if (!a || !b) continue
    const key = [aId, bId].sort().join('-')
    if (seen.has(key)) continue
    seen.add(key)

    const span = Math.hypot(b.x - a.x, b.y - a.y)
    if (span === 0) continue
    const along = { x: (b.x - a.x) / span, y: (b.y - a.y) / span }
    const inward = { x: -along.y, y: along.x }

    const thickness = wallBetween(doc, level, aId, bId)?.thickness ?? 0
    const before = wallBetween(doc, level, room.nodes[(i + count - 1) % count]!, aId)
    const after = wallBetween(doc, level, bId, room.nodes[(i + 2) % count]!)
    const cutA = (before?.thickness ?? 0) / 2
    const cutB = (after?.thickness ?? 0) / 2
    const length = Math.round(span - cutA - cutB)
    if (length <= 0) continue

    const off = thickness / 2 + STANDOFF
    dimensions.push({
      from: { x: a.x + along.x * cutA + inward.x * off, y: a.y + along.y * cutA + inward.y * off },
      to: { x: b.x - along.x * cutB + inward.x * off, y: b.y - along.y * cutB + inward.y * off },
      length,
      offset: inward,
    })
  }

  return dimensions
}

export function interiorSize(
  doc: HouseDocument,
  level: string,
  room: Room,
): { width: number; depth: number } {
  const corners = room.nodes.map((id) => doc.nodes[id]).filter((node) => node !== undefined)
  if (corners.length === 0) return { width: 0, depth: 0 }

  const xs = corners.map((corner) => corner.x)
  const ys = corners.map((corner) => corner.y)
  const half = (side: Side) =>
    Math.max(
      0,
      ...wallsOnSide(doc, level, room, side).map((w) => doc.walls[w.wall]?.thickness ?? 0),
    ) / 2

  return {
    width: Math.round(Math.max(...xs) - Math.min(...xs) - half('west') - half('east')),
    depth: Math.round(Math.max(...ys) - Math.min(...ys) - half('south') - half('north')),
  }
}

export type Extent = { x0: number; y0: number; x1: number; y1: number }

export function planExtent(doc: HouseDocument, level: string): Extent | undefined {
  const walls = Object.values(doc.walls).filter((wall) => wall.level === level)
  const nodes = walls
    .flatMap((wall) => [doc.nodes[wall.a], doc.nodes[wall.b]])
    .filter((node) => node !== undefined)
  if (nodes.length === 0) return undefined

  const half = Math.max(...walls.map((wall) => wall.thickness)) / 2
  const xs = nodes.map((node) => node.x)
  const ys = nodes.map((node) => node.y)
  return {
    x0: Math.min(...xs) - half,
    y0: Math.min(...ys) - half,
    x1: Math.max(...xs) + half,
    y1: Math.max(...ys) + half,
  }
}

export function extentDimensions(extent: Extent): Dimension[] {
  const off = STANDOFF * 2
  return [
    {
      from: { x: extent.x0, y: extent.y1 + off },
      to: { x: extent.x1, y: extent.y1 + off },
      length: Math.round(extent.x1 - extent.x0),
      offset: { x: 0, y: 1 },
    },
    {
      from: { x: extent.x1 + off, y: extent.y0 },
      to: { x: extent.x1 + off, y: extent.y1 },
      length: Math.round(extent.y1 - extent.y0),
      offset: { x: 1, y: 0 },
    },
  ]
}

export type Clearance = Dimension & { side: Side }

const DIRECTIONS: Record<Side, Point> = {
  north: { x: 0, y: 1 },
  south: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
}

export function objectClearances(
  doc: HouseDocument,
  level: string,
  room: Room,
  spot: Spot,
  size: { width: number; depth: number },
): Clearance[] {
  const corners = footprintOf(spot, size)
  const box = {
    x0: Math.min(...corners.map((corner) => corner.x)),
    y0: Math.min(...corners.map((corner) => corner.y)),
    x1: Math.max(...corners.map((corner) => corner.x)),
    y1: Math.max(...corners.map((corner) => corner.y)),
  }
  const middle = { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 }
  const starts: Record<Side, Point> = {
    north: { x: middle.x, y: box.y1 },
    south: { x: middle.x, y: box.y0 },
    east: { x: box.x1, y: middle.y },
    west: { x: box.x0, y: middle.y },
  }

  const clearances: Clearance[] = []
  for (const side of Object.keys(DIRECTIONS) as Side[]) {
    const direction = DIRECTIONS[side]
    const start = starts[side]
    const hit = nearestWall(doc, level, room, start, direction)
    if (!hit) continue
    const length = Math.round(hit.distance - hit.thickness / 2)
    if (length <= 0) continue
    clearances.push({
      side,
      from: start,
      to: { x: start.x + direction.x * length, y: start.y + direction.y * length },
      length,
      offset: { x: -direction.y, y: direction.x },
    })
  }
  return clearances
}

function nearestWall(
  doc: HouseDocument,
  level: string,
  room: Room,
  from: Point,
  direction: Point,
): { distance: number; thickness: number } | undefined {
  let best: { distance: number; thickness: number } | undefined
  const count = room.nodes.length

  for (let i = 0; i < count; i += 1) {
    const aId = room.nodes[i]!
    const bId = room.nodes[(i + 1) % count]!
    const a = doc.nodes[aId]
    const b = doc.nodes[bId]
    if (!a || !b) continue

    const distance = rayHitsSegment(from, direction, a, b)
    if (distance === undefined || distance <= 0) continue
    if (!best || distance < best.distance) {
      best = { distance, thickness: wallBetween(doc, level, aId, bId)?.thickness ?? 0 }
    }
  }
  return best
}

function rayHitsSegment(from: Point, direction: Point, a: Point, b: Point): number | undefined {
  const edge = { x: b.x - a.x, y: b.y - a.y }
  const denominator = direction.x * edge.y - direction.y * edge.x
  if (Math.abs(denominator) < 1e-9) return undefined

  const gap = { x: a.x - from.x, y: a.y - from.y }
  const t = (gap.x * edge.y - gap.y * edge.x) / denominator
  const u = (gap.x * direction.y - gap.y * direction.x) / denominator
  if (u < 0 || u > 1) return undefined
  return t
}
