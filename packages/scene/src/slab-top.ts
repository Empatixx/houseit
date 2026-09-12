import type { Corner } from './pieces'

type Surface = { outline: Corner[]; holes: Corner[][] }
const inside = (ring: Corner[], x: number, z: number) => {
  let found = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!,
      b = ring[j]!
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) found = !found
  }
  return found
}
const on = (s: Surface, x: number, z: number) =>
  inside(s.outline, x, z) && !s.holes.some((h) => inside(h, x, z))
const bounds = (s: Surface) => ({
  x0: Math.min(...s.outline.map((p) => p.x)),
  x1: Math.max(...s.outline.map((p) => p.x)),
  z0: Math.min(...s.outline.map((p) => p.z)),
  z1: Math.max(...s.outline.map((p) => p.z)),
})

// The upper room's finish owns a shared horizontal face. Keep the uncovered
// part of the lower slab, including the roof of an L's lower wing.
export function exposedSlabTop(slab: Surface, floors: Surface[]): Corner[][] | undefined {
  const b = bounds(slab)
  const covering = floors.filter((f) => {
    const c = bounds(f)
    return c.x0 < b.x1 && c.x1 > b.x0 && c.z0 < b.z1 && c.z1 > b.z0
  })
  if (!covering.length) return
  const rings = [slab, ...covering].flatMap((s) => [s.outline, ...s.holes])
  const edges = rings.flatMap((r) => r.map((a, i) => ({ a, b: r[(i + 1) % r.length]! })))
  const xs = new Set(rings.flat().map((p) => p.x))
  // Split at crossings as well as vertices: within each strip edge order is
  // fixed, so subtraction is exact for sloping boundaries and round wells too.
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]!
    for (const f of edges.slice(i + 1)) {
      const dx = e.b.x - e.a.x,
        dz = e.b.z - e.a.z
      const fx = f.b.x - f.a.x,
        fz = f.b.z - f.a.z
      const cross = dx * fz - dz * fx
      if (Math.abs(cross) < 1e-9) continue
      const x = f.a.x - e.a.x,
        z = f.a.z - e.a.z
      const t = (x * fz - z * fx) / cross,
        u = (x * dz - z * dx) / cross
      if (t > 0 && t < 1 && u > 0 && u < 1) xs.add(e.a.x + t * dx)
    }
  }
  const cuts = [...xs].filter((x) => x >= b.x0 && x <= b.x1).sort((a, b) => a - b)
  const height = (e: (typeof edges)[number], x: number) =>
    e.a.z + ((x - e.a.x) * (e.b.z - e.a.z)) / (e.b.x - e.a.x)
  const top: Corner[][] = []
  for (let i = 1; i < cuts.length; i++) {
    const x0 = cuts[i - 1]!,
      x1 = cuts[i]!,
      x = (x0 + x1) / 2
    if (x1 - x0 < 1e-7) continue
    const active = edges
      .filter((e) => x > Math.min(e.a.x, e.b.x) && x < Math.max(e.a.x, e.b.x))
      .sort((e, f) => height(e, x) - height(f, x))
    for (let j = 1; j < active.length; j++) {
      const low = active[j - 1]!,
        high = active[j]!
      const z0 = height(low, x),
        z1 = height(high, x),
        z = (z0 + z1) / 2
      if (z1 - z0 < 1e-7 || !on(slab, x, z) || covering.some((f) => on(f, x, z))) continue
      const ring = [
        { x: x0, z: height(low, x0) },
        { x: x1, z: height(low, x1) },
        { x: x1, z: height(high, x1) },
        { x: x0, z: height(high, x0) },
      ]
      top.push(
        ring.filter((p, k) => {
          const q = ring[(k + 1) % ring.length]!
          return Math.hypot(p.x - q.x, p.z - q.z) > 1e-7
        }),
      )
    }
  }
  return top
}
