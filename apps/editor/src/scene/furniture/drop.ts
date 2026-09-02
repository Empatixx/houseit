import type { HouseDocument, HouseObject, Side } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import type { Room } from '@houseit/geometry/rooms'
import { sideRun } from '@houseit/geometry/sides'
import { reachOf } from '@houseit/geometry/standing'

/** Where a thing was let go, said the way `move-object` takes it. */
export type Drop = { against?: Side; along: number; across?: number }

/** How near a wall a thing has to be let go to be put against it, in millimetres. */
const SNAP = 350

const SIDES: Side[] = ['north', 'east', 'south', 'west']

/**
 * What a drag means: a thing let go with its back this close to a wall goes
 * against that wall, this far along it; anywhere else it stands free, this far
 * across and along the room. The numbers are the ones `add-object` would take
 * to put it there, so what the drag asks for is what the command checks.
 */
export function dropOf(
  doc: HouseDocument,
  level: string,
  room: Room,
  object: HouseObject,
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

    // How far into the room the middle of the thing is from the wall's face,
    // less the half of it that has to be there anyway.
    const inward = (centre.x - run.from.x) * run.inward.x + (centre.y - run.from.y) * run.inward.y
    const gap = inward - run.thickness / 2 - reachOf(object).into / 2
    if (gap > SNAP || gap < -SNAP) continue
    if (!best || Math.abs(gap) < Math.abs(best.gap)) best = { side, gap, along }
  }

  if (best) return { against: best.side, along: round(best.along) }

  const xs = room.nodes.map((node) => doc.nodes[node]?.x ?? 0)
  const ys = room.nodes.map((node) => doc.nodes[node]?.y ?? 0)
  const low = Math.min(...xs)
  const south = Math.min(...ys)
  return {
    along: round((centre.x - low) / Math.max(1, Math.max(...xs) - low)),
    across: round((centre.y - south) / Math.max(1, Math.max(...ys) - south)),
  }
}

/** A fraction the way a person would type it, and clamped to the room. */
const round = (fraction: number) => Math.round(Math.min(1, Math.max(0, fraction)) * 1000) / 1000
