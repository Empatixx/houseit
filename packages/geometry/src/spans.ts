export type Span = { from: number; to: number }

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

export const widestSpan = (spans: Span[]): Span | undefined =>
  spans.reduce<Span | undefined>(
    (best, next) => (best && best.to - best.from >= next.to - next.from ? best : next),
    undefined,
  )

export const spanAround = (centre: number, width: number): Span => ({
  from: centre - width / 2,
  to: centre + width / 2,
})
