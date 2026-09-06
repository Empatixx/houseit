import type { HouseDocument, Side } from '@houseit/core/document'
import { partsOf } from '@houseit/core/footprint'
import type { Point } from './outlines'
import type { Room } from './rooms'
import { sideRun } from './sides'

export type Standing = {
  against?: Side
  againstNth?: number
  along: number
  across?: number
  width: number
  depth: number
  rotation?: number
}

export type Spot = {
  at: Point
  turn: number
}

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
      turn: turnOf(thing),
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
    turn: Math.atan2(-run.inward.x, run.inward.y) + turnOf(thing),
  }
}

export const turnOf = (thing: { rotation?: number }) => ((thing.rotation ?? 0) * Math.PI) / 180

export function reachOf(thing: { width: number; depth: number; rotation?: number }): {
  across: number
  into: number
} {
  const swing = turnOf(thing)
  const square = Math.abs(Math.cos(swing))
  const skew = Math.abs(Math.sin(swing))

  return {
    across: thing.width * square + thing.depth * skew,
    into: thing.depth * square + thing.width * skew,
  }
}

export function piecesOf(
  spot: Spot,
  thing: { type: string; width: number; depth: number },
): Point[][] {
  const parts = partsOf(thing.type)
  if (parts.length === 1) return [footprintOf(spot, thing)]

  const place = (x: number, y: number) =>
    onPlan(spot, thing, { x: x * thing.width, y: y * thing.depth })
  return parts.map((part) => [
    place(part.x0, part.y0),
    place(part.x1, part.y0),
    place(part.x1, part.y1),
    place(part.x0, part.y1),
  ])
}

export function onPlan(spot: Spot, size: { width: number; depth: number }, point: Point): Point {
  const x = size.width / 2 - point.x
  const y = point.y - size.depth / 2
  const cos = Math.cos(spot.turn)
  const sin = Math.sin(spot.turn)
  return { x: spot.at.x + x * cos - y * sin, y: spot.at.y + x * sin + y * cos }
}

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
