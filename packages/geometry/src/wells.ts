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
import { connectionHoles } from './connections'
import type { Point } from './outlines'
import { containsPoint, type Room, roomsOf } from './rooms'
import { runWells } from './stair-runs'
import { onPlan, standingAt } from './standing'
import { unionOfBoxes } from './union'

export type Well = {
  object: string
  type: string
  outline: Point[]
}

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

const ROUND = 24

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

export function wellsIn(doc: HouseDocument, level: string): Well[] {
  const under = levelBelow(doc, level)
  return [
    ...(under ? stairwaysOn(doc, under.id) : []),
    ...connectionHoles(doc, level),
    ...runWells(doc, level),
  ]
}

export function wellsInRoom(doc: HouseDocument, level: string, room: Room): Well[] {
  const outline = room.nodes.map((id) => doc.nodes[id]).filter((node) => node !== undefined)
  const wells = wellsIn(doc, level)
  return holesIn(
    outline,
    wells.map((well) => well.outline),
  ).map((hole) => ({ ...wells[hole.index]!, outline: hole.outline }))
}

export function holesIn(room: Point[], holes: Point[][]): { index: number; outline: Point[] }[] {
  if (room.length < 3) return []
  return holes.flatMap((hole, index) => {
    const cut = pierce(room, hole)
    return cut ? [{ index, outline: cut }] : []
  })
}

const HAIR = 20
const LEAST = 100_000

function pierce(room: Point[], hole: Point[]): Point[] | undefined {
  const inward = Math.sign(areaOf(room)) || 1
  let cut = hole
  for (let index = 0; index < room.length; index += 1) {
    const a = room[index]!
    const b = room[(index + 1) % room.length]!
    if (a.x === b.x && a.y === b.y) continue
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

function across(a: Point, b: Point, point: Point): number {
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  return ((b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x)) / length
}

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

function between(from: Point, to: Point, fromIn: number, toIn: number): Point {
  const t = fromIn / (fromIn - toIn)
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
}

function meets(a: Point, b: Point, polygon: Point[]): boolean {
  if (containsPoint(polygon, a.x, a.y) || containsPoint(polygon, b.x, b.y)) return true
  return polygon.some((point, index) => {
    const next = polygon[(index + 1) % polygon.length]!
    return crosses(a, b, point, next)
  })
}

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

function areaOf(polygon: Point[]): number {
  let total = 0
  for (let index = 0; index < polygon.length; index += 1) {
    const here = polygon[index]!
    const next = polygon[(index + 1) % polygon.length]!
    total += here.x * next.y - next.x * here.y
  }
  return total / 2
}

export function ceilingWells(doc: HouseDocument, level: string): Well[] {
  return [
    ...stairwaysOn(doc, level),
    ...connectionHoles(doc, level, true),
    ...runWells(doc, level, true),
  ]
}
