import type { HouseDocument, Side } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import type { Room } from '@houseit/geometry/rooms'
import { sideRun } from '@houseit/geometry/sides'
import { reachOf } from '@houseit/geometry/standing'

export type Drop = { against?: Side; along: number; across?: number }

const SNAP = 350

const SIDES: Side[] = ['north', 'east', 'south', 'west']

export function dropOf(
  doc: HouseDocument,
  level: string,
  room: Room,
  object: { width: number; depth: number; turn?: number },
  centre: Point,
): Drop {
  let best: { side: Side; gap: number; along: number } | undefined

  for (const side of SIDES) {
    const run = sideRun(doc, level, room, side)
    if (!run || run.length === 0) continue
    const unit = {
      x: (run.to.x - run.from.x) / run.length,
      y: (run.to.y - run.from.y) / run.length,
    }
    const along = ((centre.x - run.from.x) * unit.x + (centre.y - run.from.y) * unit.y) / run.length
    if (along < 0 || along > 1) continue

    const inward = (centre.x - run.from.x) * run.inward.x + (centre.y - run.from.y) * run.inward.y
    const gap = inward - run.thickness / 2 - reachOf(object).into / 2
    if (gap > SNAP || gap < -SNAP) continue
    if (!best || Math.abs(gap) < Math.abs(best.gap)) best = { side, gap, along }
  }

  const reach = reachOf(object)
  const fat = Math.max(0, ...room.walls.map((id) => doc.walls[id]?.thickness ?? 0)) / 2

  if (best) {
    const run = sideRun(doc, level, room, best.side)
    return { against: best.side, along: round(best.along, reach.across / 2, run?.length ?? 0) }
  }

  const xs = room.nodes.map((node) => doc.nodes[node]?.x ?? 0)
  const ys = room.nodes.map((node) => doc.nodes[node]?.y ?? 0)
  const low = Math.min(...xs)
  const south = Math.min(...ys)
  const width = Math.max(1, Math.max(...xs) - low)
  const depth = Math.max(1, Math.max(...ys) - south)
  return {
    along: round((centre.x - low) / width, reach.across / 2 + fat, width),
    across: round((centre.y - south) / depth, reach.into / 2 + fat, depth),
  }
}

function round(fraction: number, half: number, span: number): number {
  const inset = span > 2 * half ? half / span : 0.5
  const held = Math.min(1 - inset, Math.max(inset, fraction))
  return Math.round(held * 1000) / 1000
}
