export type Point = { x: number; y: number }
export type Rect = { x0: number; y0: number; x1: number; y1: number }
export type Facet = {
  points: [Point & { height: number }, Point & { height: number }, Point & { height: number }]
}
export type End = 'hip' | 'gable'
export type Side = 'north' | 'south' | 'east' | 'west'

export const ROOF_SHAPES = ['gable', 'hip', 'shed', 'flat'] as const
export type RoofShape = (typeof ROOF_SHAPES)[number]

const area = (ring: Point[]) =>
  ring.reduce((sum, a, i) => {
    const b = ring[(i + 1) % ring.length]!
    return sum + a.x * b.y - b.x * a.y
  }, 0) / 2

function inside(point: Point, ring: Point[]): boolean {
  let yes = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!
    const b = ring[j]!
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      yes = !yes
  }
  return yes
}

export function rectanglesOf(ring: Point[]): Rect[] {
  const xs = [...new Set(ring.map((p) => p.x))].sort((a, b) => a - b)
  const ys = [...new Set(ring.map((p) => p.y))].sort((a, b) => a - b)
  const filled = xs
    .slice(0, -1)
    .map((x, i) =>
      ys
        .slice(0, -1)
        .map((y, j) => inside({ x: (x + xs[i + 1]!) / 2, y: (y + ys[j + 1]!) / 2 }, ring)),
    )
  const rects: Rect[] = []
  for (;;) {
    let best: { i0: number; i1: number; j0: number; j1: number; area: number } | undefined
    for (let i0 = 0; i0 < filled.length; i0++)
      for (let j0 = 0; j0 < (filled[0]?.length ?? 0); j0++) {
        if (!filled[i0]![j0]) continue
        for (let i1 = i0; i1 < filled.length && filled[i1]![j0]; i1++)
          for (let j1 = j0; j1 < filled[0]!.length; j1++) {
            let full = true
            for (let i = i0; i <= i1 && full; i++) if (!filled[i]![j1]) full = false
            if (!full) break
            const size = (xs[i1 + 1]! - xs[i0]!) * (ys[j1 + 1]! - ys[j0]!)
            if (!best || size > best.area) best = { i0, i1, j0, j1, area: size }
          }
      }
    if (!best) return rects
    for (let i = best.i0; i <= best.i1; i++)
      for (let j = best.j0; j <= best.j1; j++) filled[i]![j] = false
    rects.push({ x0: xs[best.i0]!, x1: xs[best.i1 + 1]!, y0: ys[best.j0]!, y1: ys[best.j1 + 1]! })
  }
}

export const outlineOf = (rect: Rect): Point[] => [
  { x: rect.x0, y: rect.y0 },
  { x: rect.x1, y: rect.y0 },
  { x: rect.x1, y: rect.y1 },
  { x: rect.x0, y: rect.y1 },
]

export type Pitched = {
  shape: 'gable' | 'hip' | 'shed'
  pitch: number
  axis: 'x' | 'y'
  ends?: [End, End]
  towards?: Side
  eave: number
}

const swap = (p: Point & { height: number }) => ({ x: p.y, y: p.x, height: p.height })

export function pitchedFacets(rect: Rect, roof: Pitched): Facet[] {
  if (roof.axis === 'y') {
    const turned = pitchedFacets(
      { x0: rect.y0, x1: rect.y1, y0: rect.x0, y1: rect.x1 },
      {
        ...roof,
        axis: 'x',
        ...(roof.towards
          ? {
              towards: ({ north: 'east', south: 'west', east: 'north', west: 'south' } as const)[
                roof.towards
              ],
            }
          : {}),
      },
    )
    return turned.map((facet) => ({
      points: [swap(facet.points[0]), swap(facet.points[2]), swap(facet.points[1])],
    }))
  }
  const slope = Math.tan((roof.pitch * Math.PI) / 180)
  const { x0, x1, y0, y1 } = rect
  const e = roof.eave
  const at = (x: number, y: number, height: number) => ({ x, y, height: Math.round(height) })
  const keep = (facets: Facet[]) =>
    facets.filter(
      ({ points: [a, b, c] }) =>
        Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) > 1,
    )
  if (roof.shape === 'shed') {
    const low = roof.towards ?? 'south'
    const high = e + (y1 - y0) * slope
    const [south, north] = low === 'north' ? [high, e] : [e, high]
    return keep([
      { points: [at(x0, y0, south), at(x1, y0, south), at(x1, y1, north)] },
      { points: [at(x0, y0, south), at(x1, y1, north), at(x0, y1, north)] },
    ])
  }
  const half = (y1 - y0) / 2
  const ym = y0 + half
  const ridge = e + half * slope
  const [endA, endB] = roof.ends ?? (roof.shape === 'hip' ? ['hip', 'hip'] : ['gable', 'gable'])
  let xa = x0 + (endA === 'hip' ? half : 0)
  let xb = x1 - (endB === 'hip' ? half : 0)
  if (xa > xb) xa = xb = (x0 + x1) / 2
  const top = (x: number) => at(x, ym, ridge)
  const facets: Facet[] = [
    { points: [at(x0, y0, e), at(x1, y0, e), top(xb)] },
    { points: [at(x0, y0, e), top(xb), top(xa)] },
    { points: [at(x1, y1, e), at(x0, y1, e), top(xa)] },
    { points: [at(x1, y1, e), top(xa), top(xb)] },
  ]
  if (endA === 'hip') facets.push({ points: [at(x0, y1, e), at(x0, y0, e), top(xa)] })
  if (endB === 'hip') facets.push({ points: [at(x1, y0, e), at(x1, y1, e), top(xb)] })
  return keep(facets)
}

export const grown = (
  rect: Rect,
  by: { north: number; south: number; east: number; west: number },
): Rect => ({
  x0: rect.x0 - by.west,
  x1: rect.x1 + by.east,
  y0: rect.y0 - by.south,
  y1: rect.y1 + by.north,
})

export const ringArea = (ring: Point[]) => Math.abs(area(ring))
