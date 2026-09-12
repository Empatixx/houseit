type Point = { x: number; y: number }
const cross = (a: Point, b: Point, c: Point) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
const area = (p: Point[]) =>
  Math.abs(
    p.reduce((s, a, i) => {
      const b = p[(i + 1) % p.length]!
      return s + a.x * b.y - b.x * a.y
    }, 0),
  ) / 2
const inside = (p: Point, ring: Point[]) => {
  let yes = false
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!,
      b = ring[(i + 1) % ring.length]!
    if (
      Math.abs(cross(a, b, p)) < 1e-5 &&
      p.x >= Math.min(a.x, b.x) &&
      p.x <= Math.max(a.x, b.x) &&
      p.y >= Math.min(a.y, b.y) &&
      p.y <= Math.max(a.y, b.y)
    )
      return true
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) yes = !yes
  }
  return yes
}
function overlap(one: Point[], two: Point[]) {
  let poly = one
  const sign = Math.sign(cross(two[0]!, two[1]!, two[2]!))
  for (let i = 0; i < 3; i++) {
    const a = two[i]!,
      b = two[(i + 1) % 3]!,
      out: Point[] = []
    for (let j = 0; j < poly.length; j++) {
      const p = poly[j]!,
        q = poly[(j + 1) % poly.length]!,
        u = cross(a, b, p) * sign,
        v = cross(a, b, q) * sign
      if (u >= 0) out.push(p)
      if ((u < 0 && v > 0) || (u > 0 && v < 0)) {
        const t = u / (u - v)
        out.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) })
      }
    }
    poly = out
  }
  return area(poly)
}
export function roofMeshIssue(
  outline: Point[],
  facets: { points: Point[] }[],
  drains: Point[],
): string | undefined {
  const expected = area(outline),
    actual = facets.reduce((s, f) => s + area(f.points), 0)
  if (!facets.length || Math.abs(expected - actual) > Math.max(1, expected * 1e-5))
    return 'roof facets must cover the whole outline'
  for (const [i, f] of facets.entries()) {
    if (f.points.some((p) => !inside(p, outline))) return 'roof facet lies outside the outline'
    for (let j = 0; j < f.points.length; j++) {
      const a = f.points[j]!,
        b = f.points[(j + 1) % f.points.length]!
      for (let k = 0; k < outline.length; k++) {
        const c = outline[k]!,
          d = outline[(k + 1) % outline.length]!
        if (cross(a, b, c) * cross(a, b, d) < -1e-5 && cross(c, d, a) * cross(c, d, b) < -1e-5)
          return 'roof facet crosses the outline'
      }
    }
    for (const other of facets.slice(0, i))
      if (overlap(f.points, other.points) > 1) return 'roof facets overlap'
  }
  if (drains.some((d) => !facets.some((f) => inside(d, f.points))))
    return 'roof drain lies outside the roof'
}
