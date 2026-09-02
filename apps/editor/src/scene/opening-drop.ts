import type { HouseDocument, Side } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import type { Room } from '@houseit/geometry/rooms'
import { sideRun } from '@houseit/geometry/sides'

/** Where a door or window was let go, said the way `move-door` takes it. */
export type OpeningDrop = { toSide: Side; along: number }

const SIDES: Side[] = ['north', 'east', 'south', 'west']

/**
 * What a drag of an opening means: the side of the room whose wall the point
 * is nearest, and how far along it. An opening lives in a wall, so there is
 * no free-standing case — let go in the middle of the room, it goes to the
 * nearest wall, which is what a hand that let go early meant.
 */
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
