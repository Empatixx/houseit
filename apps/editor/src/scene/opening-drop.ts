import type { HouseDocument, Side } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import type { Room } from '@houseit/geometry/rooms'
import { sideRun } from '@houseit/geometry/sides'

export type OpeningDrop = { toSide: Side; along: number }

const SIDES: Side[] = ['north', 'east', 'south', 'west']

export function openingDropOf(
  doc: HouseDocument,
  level: string,
  room: Room,
  point: Point,
): OpeningDrop | undefined {
  let best: { side: Side; off: number; along: number } | undefined
  for (const side of SIDES) {
    const run = sideRun(doc, level, room, side)
    if (!run || run.length === 0) continue
    const unit = {
      x: (run.to.x - run.from.x) / run.length,
      y: (run.to.y - run.from.y) / run.length,
    }
    const along = ((point.x - run.from.x) * unit.x + (point.y - run.from.y) * unit.y) / run.length
    const off = Math.abs(
      (point.x - run.from.x) * run.inward.x + (point.y - run.from.y) * run.inward.y,
    )
    if (!best || off < best.off) best = { side, off, along }
  }
  if (!best) return undefined
  return {
    toSide: best.side,
    along: Math.round(Math.min(1, Math.max(0, best.along)) * 1000) / 1000,
  }
}
