import type { HouseDocument } from '@houseit/core/document'

/** A wall, end to end: `[x0, y0, x1, y1]` in millimetres. */
type Segment = [number, number, number, number]

/**
 * A plan small enough to keep beside a project's name: its walls as centre
 * lines, moved to the origin, with the box they fill.
 *
 * Not the rooms and not the floors — a card is a thumbnail, and a plan reads
 * there as its walls or not at all. It is worked out when the plan is written
 * and stored with the name, so the home screen can draw every card without
 * reading a single document.
 */
export type Outline = {
  /** The box the walls fill, in millimetres. */
  width: number
  height: number
  segments: Segment[]
}

export function outlineOf(doc: HouseDocument, level: string): Outline | undefined {
  const segments: Segment[] = []
  for (const wall of Object.values(doc.walls)) {
    if (wall.level !== level) continue
    const a = doc.nodes[wall.a]
    const b = doc.nodes[wall.b]
    if (a && b) segments.push([a.x, a.y, b.x, b.y])
  }
  if (segments.length === 0) return undefined

  const xs = segments.flatMap(([x0, , x1]) => [x0, x1])
  const ys = segments.flatMap(([, y0, , y1]) => [y0, y1])
  const left = Math.min(...xs)
  const top = Math.min(...ys)

  return {
    width: Math.round(Math.max(...xs) - left),
    height: Math.round(Math.max(...ys) - top),
    segments: segments.map(([x0, y0, x1, y1]) => [
      Math.round(x0 - left),
      Math.round(y0 - top),
      Math.round(x1 - left),
      Math.round(y1 - top),
    ]),
  }
}
