/** A stretch along a wall, in millimetres from one end. */
export type Span = { from: number; to: number }

/**
 * What is left of a length once the given stretches are taken out of it.
 *
 * Both the command that places an opening and the mesh that draws the wall need
 * this: one to find somewhere to put a window, the other to draw the wall in the
 * pieces either side of it. Overlaps are merged and anything reaching past an end
 * is clipped, so neither caller has to guard against a negative stretch.
 */
export function freeSpans(length: number, taken: Span[]): Span[] {
  const sorted = [...taken].sort((one, other) => one.from - other.from)
  const free: Span[] = []
  let cursor = 0

  for (const { from, to } of sorted) {
    if (from > cursor) free.push({ from: cursor, to: Math.min(from, length) })
    cursor = Math.max(cursor, to)
  }
  if (cursor < length) free.push({ from: Math.max(cursor, 0), to: length })

  return free.filter((span) => span.to > span.from)
}

/** The longest of the stretches, keeping the first of equals so results are stable. */
export const widestSpan = (spans: Span[]): Span | undefined =>
  spans.reduce<Span | undefined>(
    (best, next) => (best && best.to - best.from >= next.to - next.from ? best : next),
    undefined,
  )

/** The stretch a thing of `width` covers when its middle sits at `centre`. */
export const spanAround = (centre: number, width: number): Span => ({
  from: centre - width / 2,
  to: centre + width / 2,
})
