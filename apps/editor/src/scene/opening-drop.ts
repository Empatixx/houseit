import type { HouseDocument, Side } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import type { Room } from '@houseit/geometry/rooms'
import { type SideRun, sideRun, stretchOf } from '@houseit/geometry/sides'

export type OpeningDrop = { toSide: Side; along: number }

const SIDES: Side[] = ['north', 'east', 'south', 'west']

export function openingDropOf(
  doc: HouseDocument,
  level: string,
  room: Room,
  point: Point,
  width = 0,
): OpeningDrop | undefined {
  let best: { side: Side; off: number; along: number; run: SideRun } | undefined
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
    if (!best || off < best.off) best = { side, off, along, run }
  }
  if (!best) return undefined

  const at = fitted(best.run, best.along * best.run.length, width)
  if (at === undefined) return undefined
  return { toSide: best.side, along: Math.round((at / best.run.length) * 1000) / 1000 }
}

function fitted(run: SideRun, at: number, width: number): number | undefined {
  const stretches = run.walls
    .map((wall) => stretchOf(run, wall.wall))
    .filter((stretch) => stretch !== undefined)
    .filter((stretch) => stretch.to - stretch.from >= width)
  if (stretches.length === 0) return undefined

  const nearest = stretches.reduce((best, stretch) =>
    away(stretch, at) < away(best, at) ? stretch : best,
  )
  return Math.min(nearest.to - width / 2, Math.max(nearest.from + width / 2, at))
}

const away = (stretch: { from: number; to: number }, at: number) =>
  at < stretch.from ? stretch.from - at : at > stretch.to ? at - stretch.to : 0
