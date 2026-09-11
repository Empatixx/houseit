import type { Ramp, Shaft } from '@houseit/core/connections'
import type { HouseDocument } from '@houseit/core/document'
import type { Point } from './outlines'

export const shaftOutline = (s: Shaft): Point[] => [
  { x: s.x - s.width / 2, y: s.y - s.depth / 2 },
  { x: s.x + s.width / 2, y: s.y - s.depth / 2 },
  { x: s.x + s.width / 2, y: s.y + s.depth / 2 },
  { x: s.x - s.width / 2, y: s.y + s.depth / 2 },
]
export function shaftsOn(doc: HouseDocument, level: string): Shaft[] {
  const at = doc.levels[level]
  if (!at) return []
  return Object.values(doc.levels).flatMap((base) =>
    (base.shafts ?? []).filter((s) => {
      const top = doc.levels[s.to]
      return top && at.elevation >= base.elevation && at.elevation <= top.elevation
    }),
  )
}
export const shaftOutside = (s: Shaft): Point[] =>
  shaftOutline({
    ...s,
    width: s.width + 2 * (s.enclosure?.thickness ?? 0),
    depth: s.depth + 2 * (s.enclosure?.thickness ?? 0),
  })
export function shaftWallParts(s: Shaft) {
  const e = s.enclosure
  if (!e) return []
  const t = e.thickness
  return (['north', 'south', 'east', 'west'] as const).flatMap((side) => {
    const horizontal = side === 'north' || side === 'south'
    const span = horizontal ? s.width + 2 * t : s.depth
    const across = horizontal ? s.depth : s.width
    const sign = side === 'north' || side === 'east' ? 1 : -1
    const middle = (sign * (across + t)) / 2
    const box = (along: number, length: number, door: boolean) => ({
      x: s.x + (horizontal ? along : middle),
      y: s.y + (horizontal ? middle : along),
      width: horizontal ? length : t,
      depth: horizontal ? t : length,
      door,
    })
    if (side !== e.doorSide) return [box(0, span, false)]
    const end = (span - e.doorWidth) / 2
    return [
      box(-(span + e.doorWidth) / 4, end, false),
      box(0, e.doorWidth, true),
      box((span + e.doorWidth) / 4, end, false),
    ]
  })
}
export const rampDirection = (r: Ramp): Point => ({
  x: r.direction === 'east' ? 1 : r.direction === 'west' ? -1 : 0,
  y: r.direction === 'north' ? 1 : r.direction === 'south' ? -1 : 0,
})
export function rampOutline(r: Ramp, from = 0, to = 1): Point[] {
  const d = rampDirection(r)
  return [
    [from, -1],
    [to, -1],
    [to, 1],
    [from, 1],
  ].map(([t, side]) => ({
    x: r.x + d.x * r.length * t! - ((d.y * r.width) / 2) * side!,
    y: r.y + d.y * r.length * t! + ((d.x * r.width) / 2) * side!,
  }))
}
export function connectionHoles(doc: HouseDocument, level: string, ceiling = false) {
  const at = doc.levels[level]
  if (!at) return []
  return Object.values(doc.levels).flatMap((base) => [
    ...(base.shafts ?? [])
      .filter((s) => {
        const top = doc.levels[s.to]
        return (
          top &&
          at.elevation >= (ceiling ? base.elevation : base.elevation + 1) &&
          at.elevation <= top.elevation
        )
      })
      .map((s) => ({ object: s.id, type: 'lift-shaft', outline: shaftOutline(s) })),
    ...(base.ramps ?? []).flatMap((r) => {
      const top = doc.levels[r.to]
      if (!top || (ceiling ? base.id !== level : top.id !== level)) return []
      const rise = top.elevation - base.elevation
      const from = Math.max(0, (rise - (base.slabThickness ?? 250) - 2100) / rise)
      return [{ object: r.id, type: 'ramp', outline: rampOutline(r, from) }]
    }),
  ])
}
