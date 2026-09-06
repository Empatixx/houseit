import type { Point } from './outlines'

export type Box = { x0: number; y0: number; x1: number; y1: number }

export const boxOf = (points: Point[]): Box => ({
  x0: Math.min(...points.map((point) => point.x)),
  y0: Math.min(...points.map((point) => point.y)),
  x1: Math.max(...points.map((point) => point.x)),
  y1: Math.max(...points.map((point) => point.y)),
})

const SLACK = 60

export const clashes = (one: Box, other: Box, slack = SLACK) =>
  one.x0 + slack < other.x1 &&
  other.x0 + slack < one.x1 &&
  one.y0 + slack < other.y1 &&
  other.y0 + slack < one.y1

export const clashesAny = (one: Box[], other: Box[], slack = SLACK) =>
  one.some((a) => other.some((b) => clashes(a, b, slack)))

export const wallBox = (a: Point, b: Point, thickness: number): Box => {
  const half = thickness / 2
  const along = Math.hypot(b.x - a.x, b.y - a.y) || 1
  const out = { x: (-(b.y - a.y) / along) * half, y: ((b.x - a.x) / along) * half }

  return boxOf([
    { x: a.x + out.x, y: a.y + out.y },
    { x: a.x - out.x, y: a.y - out.y },
    { x: b.x + out.x, y: b.y + out.y },
    { x: b.x - out.x, y: b.y - out.y },
  ])
}

export const INSIDE_A_WALL = 20
