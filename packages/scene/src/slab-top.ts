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
  if (
    rings.some((r) =>
      r.some((p, i) => {
        const q = r[(i + 1) % r.length]!
        return p.x !== q.x && p.z !== q.z
      }),
    )
  )
    return
  const points = rings.flat()
  const xs = [...new Set(points.map((p) => p.x).filter((x) => x >= b.x0 && x <= b.x1))].sort(
    (a, b) => a - b,
  )
  const zs = [...new Set(points.map((p) => p.z).filter((z) => z >= b.z0 && z <= b.z1))].sort(
    (a, b) => a - b,
  )
  const top: Corner[][] = []
  for (let i = 1; i < xs.length; i++)
    for (let j = 1; j < zs.length; j++) {
      const x = (xs[i - 1]! + xs[i]!) / 2,
        z = (zs[j - 1]! + zs[j]!) / 2
      if (!on(slab, x, z) || covering.some((f) => on(f, x, z))) continue
      top.push([
        { x: xs[i - 1]!, z: zs[j - 1]! },
        { x: xs[i]!, z: zs[j - 1]! },
        { x: xs[i]!, z: zs[j]! },
        { x: xs[i - 1]!, z: zs[j]! },
      ])
    }
  return top
}
