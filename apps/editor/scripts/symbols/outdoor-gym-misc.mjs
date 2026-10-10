import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../public/symbols')
const INK = '#212121'
const FINISH = '#ffffff'
const LIGHT = '#e9e9e9'
const GREY = '#d6d6d6'

const num = (v) => String(Math.round(v * 100) / 100)
const units = (mm) => Math.round((mm / 25.4) * 100) / 100

function attrs(o) {
  return Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => ` ${k}="${typeof v === 'number' ? num(v) : v}"`)
    .join('')
}

function paint({ f = FINISH, w = 1, d, stroke = INK } = {}) {
  return {
    fill: f,
    stroke: w ? stroke : undefined,
    'stroke-width': w || undefined,
    'stroke-linejoin': w ? 'round' : undefined,
    'stroke-linecap': w ? 'round' : undefined,
    'stroke-dasharray': d,
  }
}

const rect = (x, y, w, h, o = {}) =>
  `<rect${attrs({ x, y, width: w, height: h, rx: o.rx, ...paint(o) })}/>`
const circle = (cx, cy, r, o = {}) => `<circle${attrs({ cx, cy, r, ...paint(o) })}/>`
const ellipse = (cx, cy, rx, ry, o = {}) => `<ellipse${attrs({ cx, cy, rx, ry, ...paint(o) })}/>`
const line = (x1, y1, x2, y2, o = {}) =>
  `<line${attrs({ x1, y1, x2, y2, ...paint({ f: undefined, w: 0.5, ...o }) })}/>`
const path = (d, o = {}) => `<path${attrs({ d, ...paint(o) })}/>`
const stroke = (d, o = {}) => path(d, { f: 'none', w: 0.5, ...o })
const polygon = (pts, o = {}) =>
  `<polygon${attrs({ points: pts.map((p) => p.map(num).join(',')).join(' '), ...paint(o) })}/>`
const group = (transform, body) => `<g transform="${transform}">${body.join('')}</g>`

function save(file, widthMm, depthMm, draw) {
  const W = units(widthMm)
  const H = units(depthMm)
  const body = draw(W, H).flat(Infinity).join('\n')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${num(W)}" height="${num(H)}" viewBox="0 0 ${num(W)} ${num(H)}" fill="none">\n${body}\n</svg>\n`
  writeFileSync(join(OUT, file), svg)
}

function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const P = (p) => `${num(p[0])} ${num(p[1])}`

function lobes(rng, count, jitter, bulge) {
  const pts = []
  for (let i = 0; i < count; i++) {
    const a = ((i + (rng() - 0.5) * 0.5) / count) * Math.PI * 2
    const r = 1 - jitter * rng()
    pts.push([r * Math.cos(a), r * Math.sin(a)])
  }
  return pts.map((p0, i) => {
    const p1 = pts[(i + 1) % count]
    const m = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2]
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
    const ml = Math.hypot(m[0], m[1]) || 1
    return { p0, c: [m[0] + (m[0] / ml) * len * bulge, m[1] + (m[1] / ml) * len * bulge], p1 }
  })
}

function boundsOf(segs) {
  const b = [Infinity, Infinity, -Infinity, -Infinity]
  for (const { p0, c, p1 } of segs) {
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const u = 1 - t
      const x = u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0]
      const y = u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]
      b[0] = Math.min(b[0], x)
      b[1] = Math.min(b[1], y)
      b[2] = Math.max(b[2], x)
      b[3] = Math.max(b[3], y)
    }
  }
  return b
}

function fitTo(b, x0, y0, x1, y1) {
  const sx = (x1 - x0) / (b[2] - b[0])
  const sy = (y1 - y0) / (b[3] - b[1])
  const map = (p) => [x0 + (p[0] - b[0]) * sx, y0 + (p[1] - b[1]) * sy]
  map.scale = Math.min(sx, sy)
  return map
}

const outlineOf = (segs, map) =>
  `M${P(map(segs[0].p0))}${segs.map(({ c, p1 }) => `Q${P(map(c))} ${P(map(p1))}`).join('')}Z`

function branches(rng, map, from, count, reach, forks, widths = [1, 0.5, 0.5]) {
  const out = []
  const grow = (p, a, len, depth) => {
    const q = [p[0] + Math.cos(a) * len, p[1] + Math.sin(a) * len]
    const a1 = map(p)
    const a2 = map(q)
    out.push(line(a1[0], a1[1], a2[0], a2[1], { w: widths[Math.min(depth, widths.length - 1)] }))
    if (depth >= forks) return
    const spread = 0.35 + rng() * 0.3
    grow(q, a - spread, len * (0.55 + rng() * 0.15), depth + 1)
    grow(q, a + spread, len * (0.55 + rng() * 0.15), depth + 1)
  }
  const start = rng() * Math.PI * 2
  for (let i = 0; i < count; i++) {
    const a = start + ((i + (rng() - 0.5) * 0.6) / count) * Math.PI * 2
    grow(from, a, reach * (0.85 + rng() * 0.15), 0)
  }
  return out
}

function leafMarks(rng, count, inside, size, map) {
  const out = []
  let tries = 0
  while (out.length < count && tries++ < count * 30) {
    const p = [rng() * 2 - 1, rng() * 2 - 1]
    if (!inside(p)) continue
    const a = rng() * Math.PI * 2
    const q = map(p)
    const s = size * (0.7 + rng() * 0.6)
    const dx = Math.cos(a) * s
    const dy = Math.sin(a) * s
    out.push(
      stroke(`M${P(q)}q${num(dx / 2 - dy / 2)} ${num(dy / 2 + dx / 2)} ${num(dx)} ${num(dy)}`, {
        w: 0.5,
      }),
    )
  }
  return out
}

const inUnit = (r) => (p) => Math.hypot(p[0], p[1]) < r

function leaf(base, tip, width, map, w = 1) {
  const d = [tip[0] - base[0], tip[1] - base[1]]
  const len = Math.hypot(d[0], d[1])
  const n = [-d[1] / len, d[0] / len]
  const at = (t, s) =>
    map([base[0] + d[0] * t + n[0] * width * s, base[1] + d[1] * t + n[1] * width * s])
  return [
    path(
      `M${P(map(base))}C${P(at(0.25, 1))} ${P(at(0.7, 0.85))} ${P(map(tip))}C${P(at(0.7, -0.85))} ${P(at(0.25, -1))} ${P(map(base))}Z`,
      { w },
    ),
    stroke(`M${P(map(base))}L${P(at(0.92, 0))}`, { w: w / 2 }),
  ]
}

function pottedPlant(file, sizeMm, seed, count, rings, w) {
  save(file, sizeMm, sizeMm, (W, H) => {
    const rng = seeded(seed)
    const s = W / 2 - 0.5
    const map = (p) => [W / 2 + p[0] * s, H / 2 + p[1] * s]
    const out = [
      circle(W / 2, H / 2, s * 0.5, { f: LIGHT, w }),
      circle(W / 2, H / 2, s * 0.44, { f: GREY, w: 0.5 }),
    ]
    for (const [k, ring] of rings.entries()) {
      const offset = rng() * Math.PI * 2
      const n = count[k]
      for (let i = 0; i < n; i++) {
        const a = offset + ((i + (rng() - 0.5) * 0.4) / n) * Math.PI * 2
        const r1 = ring.reach * (0.85 + rng() * 0.15)
        const base = [Math.cos(a) * ring.from, Math.sin(a) * ring.from]
        const tip = [Math.cos(a) * r1, Math.sin(a) * r1]
        out.push(leaf(base, tip, ring.width * (0.85 + rng() * 0.3), map, w))
      }
    }
    return out
  })
}

pottedPlant(
  'potted-plant.svg',
  1067,
  11,
  [9, 5],
  [
    { from: 0.08, reach: 1, width: 0.2 },
    { from: 0.04, reach: 0.62, width: 0.15 },
  ],
  1,
)
pottedPlant(
  'potted-plant-m.svg',
  838,
  23,
  [7, 4],
  [
    { from: 0.06, reach: 1, width: 0.26 },
    { from: 0.04, reach: 0.6, width: 0.2 },
  ],
  0.75,
)
pottedPlant(
  'potted-plant-s.svg',
  660,
  37,
  [8, 5],
  [
    { from: 0.05, reach: 1, width: 0.3 },
    { from: 0.03, reach: 0.58, width: 0.24 },
  ],
  0.5,
)

function canopy(file, wMm, dMm, seed, opts) {
  save(file, wMm, dMm, (W, H) => {
    const rng = seeded(seed)
    const segs = lobes(rng, opts.lobes, opts.jitter, opts.bulge)
    const map = fitTo(boundsOf(segs), 0.5, 0.5, W - 0.5, H - 0.5)
    const out = [path(outlineOf(segs, map))]
    if (opts.inner) {
      const inner = lobes(rng, opts.inner.lobes, opts.inner.jitter, opts.bulge).map(
        ({ p0, c, p1 }) => {
          const k = opts.inner.scale
          return { p0: [p0[0] * k, p0[1] * k], c: [c[0] * k, c[1] * k], p1: [p1[0] * k, p1[1] * k] }
        },
      )
      out.push(stroke(outlineOf(inner, map), { d: '2 1.5' }))
    }
    out.push(opts.draw(rng, map, W, H))
    return out
  })
}

canopy('tree-deciduous-lime.svg', 4646, 3408, 101, {
  lobes: 13,
  jitter: 0.16,
  bulge: 0.32,
  inner: { lobes: 9, jitter: 0.2, scale: 0.68 },
  draw: (rng, map) => {
    const t = map([0, 0])
    return [
      branches(rng, map, [0, 0], 6, 0.38, 2, [1, 0.5, 0.5]),
      leafMarks(rng, 70, inUnit(0.82), 2.4, map),
      circle(t[0], t[1], 3.2),
    ]
  },
})

canopy('tree-birch-twin.svg', 3135, 3359, 211, {
  lobes: 24,
  jitter: 0.2,
  bulge: 0.38,
  draw: (rng, map) => {
    const a = [-0.2, 0.08]
    const b = [0.17, -0.1]
    const ta = map(a)
    const tb = map(b)
    return [
      branches(rng, map, a, 5, 0.28, 2, [0.5, 0.5, 0.5]),
      branches(rng, map, b, 5, 0.28, 2, [0.5, 0.5, 0.5]),
      leafMarks(rng, 90, inUnit(0.85), 1.5, map),
      circle(ta[0], ta[1], 2.2),
      circle(tb[0], tb[1], 1.9),
    ]
  },
})

save('tree-spruce.svg', 3200, 3200, (W, H) => {
  const rng = seeded(307)
  const s = W / 2 - 0.5
  const map = (p) => [W / 2 + p[0] * s, H / 2 + p[1] * s]
  const n = 22
  const tips = []
  const start = rng()
  for (let i = 0; i < n; i++) {
    const a = ((i + start + (rng() - 0.5) * 0.3) / n) * Math.PI * 2
    tips.push({ a, r: 0.86 + rng() * 0.14 })
  }
  const star = (k, twist) => {
    const pts = []
    tips.forEach(({ a, r }, i) => {
      const next = tips[(i + 1) % n]
      const mid = a + ((next.a - a + Math.PI * 4) % (Math.PI * 2)) / 2
      pts.push(map([Math.cos(a + twist) * r * k, Math.sin(a + twist) * r * k]))
      pts.push(map([Math.cos(mid + twist) * r * k * 0.72, Math.sin(mid + twist) * r * k * 0.72]))
    })
    return pts
  }
  const out = [polygon(star(1, 0)), polygon(star(0.58, Math.PI / n), { w: 0.5 })]
  for (const { a, r } of tips) {
    const tip = map([Math.cos(a) * r, Math.sin(a) * r])
    const c = map([0, 0])
    out.push(line(c[0], c[1], tip[0], tip[1]))
    for (let t = 0.3; t < 0.95; t += 0.16) {
      const p = [Math.cos(a) * r * t, Math.sin(a) * r * t]
      const len = 0.09 * (1.1 - t)
      for (const side of [-1, 1]) {
        const b = a + side * 0.5
        const q = map([p[0] + Math.cos(b) * len, p[1] + Math.sin(b) * len])
        const pp = map(p)
        out.push(line(pp[0], pp[1], q[0], q[1]))
      }
    }
  }
  const c = map([0, 0])
  out.push(circle(c[0], c[1], 2.4))
  return out
})

save('shrub-round.svg', 1340, 1212, (W, H) => {
  const rng = seeded(401)
  const segs = lobes(rng, 15, 0.12, 0.3)
  const map = fitTo(boundsOf(segs), 0.5, 0.5, W - 0.5, H - 0.5)
  const inner = []
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rng()
    const c = map([Math.cos(a) * 0.42, Math.sin(a) * 0.42])
    const r = W * 0.11
    const a0 = a + Math.PI * 0.3
    inner.push(
      stroke(
        `M${num(c[0] + Math.cos(a0) * r)} ${num(c[1] + Math.sin(a0) * r)}A${num(r)} ${num(r)} 0 0 0 ${num(c[0] + Math.cos(a0 + 2.4) * r)} ${num(c[1] + Math.sin(a0 + 2.4) * r)}`,
      ),
    )
  }
  return [path(outlineOf(segs, map)), inner, leafMarks(rng, 26, inUnit(0.8), 1.6, map)]
})

save('shrub-hydrangea.svg', 1240, 1489, (W, H) => {
  const rng = seeded(503)
  const segs = lobes(rng, 17, 0.14, 0.3)
  const map = fitTo(boundsOf(segs), 0.5, 0.5, W - 0.5, H - 0.5)
  const out = [path(outlineOf(segs, map)), leafMarks(rng, 20, inUnit(0.85), 1.6, map)]
  const heads = [
    [-0.4, -0.38],
    [0.36, -0.42],
    [0.02, 0.02],
    [-0.42, 0.4],
    [0.4, 0.36],
    [0.02, -0.68],
    [-0.02, 0.7],
  ]
  for (const h of heads) {
    const c = map(h)
    const r = 5.2 + rng() * 1.2
    out.push(circle(c[0], c[1], r, { w: 0.5 }))
    out.push(circle(c[0], c[1], 0.9, { w: 0.5 }))
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rng()
      out.push(circle(c[0] + Math.cos(a) * r * 0.6, c[1] + Math.sin(a) * r * 0.6, 1.1, { w: 0.5 }))
    }
  }
  return out
})

save('grass-ornamental.svg', 1400, 1400, (W, H) => {
  const rng = seeded(601)
  const s = W / 2 - 0.5
  const map = (p) => [W / 2 + p[0] * s, H / 2 + p[1] * s]
  const segs = lobes(rng, 20, 0.22, 0.25).map(({ p0, c, p1 }) => ({
    p0: [p0[0] * 0.78, p0[1] * 0.78],
    c: [c[0] * 0.78, c[1] * 0.78],
    p1: [p1[0] * 0.78, p1[1] * 0.78],
  }))
  const out = [path(outlineOf(segs, map), { w: 0 })]
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + rng() * 0.3
    const r0 = 0.06 + rng() * 0.08
    const r1 = 0.62 + rng() * 0.36
    const bend = (rng() - 0.5) * 0.5
    const p0 = map([Math.cos(a) * r0, Math.sin(a) * r0])
    const p1 = map([Math.cos(a + bend) * r1, Math.sin(a + bend) * r1])
    const c = map([Math.cos(a + bend * 0.2) * r1 * 0.6, Math.sin(a + bend * 0.2) * r1 * 0.6])
    out.push(stroke(`M${P(p0)}Q${P(c)} ${P(p1)}`))
  }
  out.push(circle(W / 2, H / 2, s * 0.07, { w: 0.5 }))
  return out
})

save('hedge-clipped.svg', 2000, 600, (W, H) => {
  const rng = seeded(701)
  const pts = []
  const r = 3
  const step = 3
  const edge = (x0, y0, x1, y1, inX, inY) => {
    const len = Math.hypot(x1 - x0, y1 - y0)
    const n = Math.max(1, Math.round(len / step))
    for (let i = 0; i < n; i++) {
      const t = i / n
      const j = rng() * 0.7
      pts.push([x0 + (x1 - x0) * t + inX * j, y0 + (y1 - y0) * t + inY * j])
    }
  }
  const a = 1
  edge(a + r, a, W - a - r, a, 0, 1)
  edge(W - a, a + r, W - a, H - a - r, -1, 0)
  edge(W - a - r, H - a, a + r, H - a, 0, -1)
  edge(a, H - a - r, a, a + r, 1, 0)
  const cx = W / 2
  const cy = H / 2
  const segs = pts.map((p0, i) => {
    const p1 = pts[(i + 1) % pts.length]
    const m = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2]
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
    const dx = Math.abs(m[0] - cx) / (W / 2)
    const dy = Math.abs(m[1] - cy) / (H / 2)
    const out = dx > dy ? [Math.sign(m[0] - cx), 0] : [0, Math.sign(m[1] - cy)]
    return { p0, c: [m[0] + out[0] * len * 0.3, m[1] + out[1] * len * 0.3], p1 }
  })
  const map = fitTo(boundsOf(segs), 0.5, 0.5, W - 0.5, H - 0.5)
  const toBox = (p) => [0.5 + ((p[0] + 1) / 2) * (W - 1), 0.5 + ((p[1] + 1) / 2) * (H - 1)]
  const inside = (p) => Math.abs(p[0]) < 0.94 && Math.abs(p[1]) < 0.75
  return [path(outlineOf(segs, map)), leafMarks(rng, 60, inside, 1.4, toBox)]
})

save('water-lilies.svg', 679, 630, () => {
  const pad = (cx, cy, r, notch) => {
    const half = 0.22
    const a0 = notch + half
    const a1 = notch - half + Math.PI * 2
    const sx = cx + Math.cos(a0) * r
    const sy = cy + Math.sin(a0) * r
    const ex = cx + Math.cos(a1) * r
    const ey = cy + Math.sin(a1) * r
    const veins = []
    for (let i = 1; i < 8; i++) {
      const a = a0 + ((a1 - a0) * i) / 8
      veins.push(
        line(cx, cy, cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.85, { w: 0.25 }),
      )
    }
    return [
      path(
        `M${num(cx)} ${num(cy)}L${num(sx)} ${num(sy)}A${num(r)} ${num(r)} 0 1 1 ${num(ex)} ${num(ey)}Z`,
        { w: 0.5 },
      ),
      veins,
    ]
  }
  const flower = (cx, cy) => {
    const out = []
    for (const [n, len, wid, twist] of [
      [8, 4.4, 1.5, 0],
      [6, 2.9, 1.2, 0.4],
    ]) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + twist
        const tx = cx + Math.cos(a) * len
        const ty = cy + Math.sin(a) * len
        const nx = -Math.sin(a) * wid
        const ny = Math.cos(a) * wid
        const mx = cx + Math.cos(a) * len * 0.5
        const my = cy + Math.sin(a) * len * 0.5
        out.push(
          path(
            `M${num(cx)} ${num(cy)}Q${num(mx + nx)} ${num(my + ny)} ${num(tx)} ${num(ty)}Q${num(mx - nx)} ${num(my - ny)} ${num(cx)} ${num(cy)}Z`,
            { w: 0.4 },
          ),
        )
      }
    }
    out.push(circle(cx, cy, 1, { f: GREY, w: 0.4 }))
    return out
  }
  return [
    pad(9, 9, 8.3, 0.9),
    pad(19.4, 15.6, 6.6, 3.6),
    pad(8.4, 19.2, 4.6, -1.2),
    flower(19.6, 6.2),
  ]
})

save('fish-koi.svg', 420, 150, (W, H) => {
  const cy = H / 2
  const body = `M4 ${num(cy)}C6 ${num(cy - 1.2)} 9 ${num(cy - 1.75)} 12 ${num(cy - 1.4)}C14.4 ${num(cy - 1.1)} 15.9 ${num(cy - 0.6)} 15.95 ${num(cy)}C15.9 ${num(cy + 0.6)} 14.4 ${num(cy + 1.1)} 12 ${num(cy + 1.4)}C9 ${num(cy + 1.75)} 6 ${num(cy + 1.2)} 4 ${num(cy)}Z`
  const tail = `M4.4 ${num(cy)}C3.2 ${num(cy - 0.6)} 1.6 ${num(cy - 1.9)} 0.5 ${num(cy - 2.1)}C1.3 ${num(cy - 1)} 1.6 ${num(cy - 0.3)} 1.2 ${num(cy)}C1.6 ${num(cy + 0.3)} 1.3 ${num(cy + 1)} 0.5 ${num(cy + 2.1)}C1.6 ${num(cy + 1.9)} 3.2 ${num(cy + 0.6)} 4.4 ${num(cy)}Z`
  const fin = (s) =>
    `M12 ${num(cy + s * 1.3)}C11.3 ${num(cy + s * 2.2)} 10.3 ${num(cy + s * 2.7)} 9.6 ${num(cy + s * 2.75)}C10 ${num(cy + s * 2.1)} 10.6 ${num(cy + s * 1.6)} 11 ${num(cy + s * 1.4)}Z`
  const pelvic = (s) =>
    `M7.6 ${num(cy + s * 1.2)}C7.2 ${num(cy + s * 1.7)} 6.6 ${num(cy + s * 1.95)} 6.1 ${num(cy + s * 1.95)}C6.4 ${num(cy + s * 1.5)} 6.9 ${num(cy + s * 1.25)} 7.2 ${num(cy + s * 1.15)}Z`
  return [
    path(tail, { w: 0.4 }),
    stroke(`M1.4 ${num(cy - 1.2)}L3.8 ${num(cy - 0.2)}M1.4 ${num(cy + 1.2)}L3.8 ${num(cy + 0.2)}`, {
      w: 0.2,
    }),
    path(fin(-1), { w: 0.4 }),
    path(fin(1), { w: 0.4 }),
    path(pelvic(-1), { w: 0.4 }),
    path(pelvic(1), { w: 0.4 }),
    path(body, { w: 0.5 }),
    path(
      `M8.2 ${num(cy - 1.5)}C9.4 ${num(cy - 1.2)} 10.6 ${num(cy - 0.2)} 10.2 ${num(cy + 0.6)}C9.2 ${num(cy + 0.9)} 8.1 ${num(cy - 0.2)} 8.2 ${num(cy - 1.5)}Z`,
      { f: GREY, w: 0 },
    ),
    path(
      `M12.6 ${num(cy - 1.2)}C13.8 ${num(cy - 0.8)} 14.6 ${num(cy - 0.4)} 14.2 ${num(cy + 0.3)}C13.4 ${num(cy + 0.4)} 12.6 ${num(cy - 0.2)} 12.6 ${num(cy - 1.2)}Z`,
      { f: GREY, w: 0 },
    ),
    path(
      `M5.6 ${num(cy + 0.2)}C6.4 ${num(cy + 0.4)} 7 ${num(cy + 1)} 6.6 ${num(cy + 1.25)}C6 ${num(cy + 1.1)} 5.5 ${num(cy + 0.7)} 5.6 ${num(cy + 0.2)}Z`,
      { f: GREY, w: 0 },
    ),
    stroke(`M5 ${num(cy)}L13 ${num(cy)}`, { w: 0.2, d: '0.6 0.5' }),
    stroke(`M14.4 ${num(cy - 1.05)}Q13.9 ${num(cy)} 14.4 ${num(cy + 1.05)}`, { w: 0.25 }),
    circle(14.9, cy - 0.65, 0.22, { f: INK, w: 0 }),
    circle(14.9, cy + 0.65, 0.22, { f: INK, w: 0 }),
  ]
})

save('flower-bed-raised.svg', 2000, 800, (W, H) => {
  const rng = seeded(801)
  const t = 2.5
  const out = [
    rect(0.5, 0.5, W - 1, H - 1),
    rect(0.5 + t, 0.5 + t, W - 1 - 2 * t, H - 1 - 2 * t, { f: LIGHT }),
    line(0.5, 0.5, 0.5 + t, 0.5 + t),
    line(W - 0.5, 0.5, W - 0.5 - t, 0.5 + t),
    line(0.5, H - 0.5, 0.5 + t, H - 0.5 - t),
    line(W - 0.5, H - 0.5, W - 0.5 - t, H - 0.5 - t),
  ]
  const rows = [H * 0.33, H * 0.67]
  for (const [k, y] of rows.entries()) {
    for (let i = 0; i < 7; i++) {
      const x = 0.5 + t + 5 + ((W - 1 - 2 * t - 10) * (i + (k ? 0.5 : 0) + 0.25)) / 7.5
      const segs = lobes(rng, 7, 0.2, 0.35)
      const r = 3.6 + rng() * 0.6
      const map = (p) => [x + p[0] * r, y + p[1] * r]
      out.push(path(outlineOf(segs, map), { w: 0.5 }))
      const flowers = 2 + Math.floor(rng() * 2)
      for (let f = 0; f < flowers; f++) {
        const a = rng() * Math.PI * 2
        const fx = x + Math.cos(a) * r * 0.4
        const fy = y + Math.sin(a) * r * 0.4
        for (let p = 0; p < 5; p++) {
          const b = (p / 5) * Math.PI * 2
          out.push(circle(fx + Math.cos(b) * 0.55, fy + Math.sin(b) * 0.55, 0.45, { w: 0.25 }))
        }
        out.push(circle(fx, fy, 0.3, { f: INK, w: 0 }))
      }
    }
  }
  return out
})

save('outdoor-dining.svg', 2769, 2769, (W, H) => {
  const cx = W / 2
  const cy = H / 2
  const tableR = units(700)
  const cw = units(520)
  const cd = units(560)
  const rc = tableR - units(120) + cd / 2
  const chair = [
    rect(-cw / 2, -cd / 2, cw, cd, { rx: 2 }),
    rect(-cw / 2 + 0.2, cd / 2 - 3.2, cw - 0.4, 3, { rx: 1.2 }),
    rect(-cw / 2, -cd / 2 + 2, 2.2, cd - 4, { rx: 1 }),
    rect(cw / 2 - 2.2, -cd / 2 + 2, 2.2, cd - 4, { rx: 1 }),
    [-4, 0, 4].map((y) => line(-cw / 2 + 3, y, cw / 2 - 3, y)),
  ]
  const out = []
  for (let i = 0; i < 6; i++) {
    out.push(
      group(
        `translate(${num(cx)} ${num(cy)}) rotate(${num(i * 60 + 30)}) translate(0 ${num(rc)})`,
        chair.flat(),
      ),
    )
  }
  out.push(circle(cx, cy, tableR))
  const inner = tableR - 1.6
  out.push(circle(cx, cy, inner, { w: 0.5, f: 'none' }))
  for (let y = -inner + 3; y < inner; y += 3) {
    const half = Math.sqrt(inner * inner - y * y)
    out.push(line(cx - half, cy + y, cx + half, cy + y, { w: 0.25 }))
  }
  const R = units(1350)
  const pts = []
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2
    pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R])
  }
  out.push(polygon(pts, { f: 'none', w: 0.5, d: '3 2' }))
  for (const p of pts) out.push(line(cx, cy, p[0], p[1], { d: '3 2' }))
  out.push(circle(cx, cy, 1.6, { f: GREY }))
  return out
})

save('yoga-mat.svg', 610, 1727, (W, H) => [
  rect(0.5, 0.5, W - 1, H - 1, { rx: 0.8 }),
  rect(0.5, 0.5, W - 1, 5.4, { rx: 2.2 }),
  line(1.2, 2.2, W - 1.2, 2.2, { w: 0.25 }),
  line(1.2, 3.9, W - 1.2, 3.9, { w: 0.25 }),
  line(1.8, 7, 1.8, H - 1.8, { w: 0.25 }),
  line(W - 1.8, 7, W - 1.8, H - 1.8, { w: 0.25 }),
  line(1.8, H - 1.8, W - 1.8, H - 1.8, { w: 0.25 }),
])

save('railing.svg', 2311, 127, (W, H) => {
  const posts = 4
  const out = [rect(0.5, H / 2 - 1.2, W - 1, 2.4, { rx: 1.2 })]
  for (let i = 0; i < posts; i++) {
    const x = 2.5 + ((W - 5) * i) / (posts - 1)
    out.push(circle(x, H / 2, 1.9, { f: INK, w: 0 }))
  }
  return out
})

save('post.svg', 229, 229, (W, H) => [
  rect(0.5, 0.5, W - 1, H - 1, { w: 0.5 }),
  rect(1.3, 1.3, W - 2.6, H - 2.6, { f: 'none', w: 0.25 }),
  line(1.3, 1.3, W - 1.3, H - 1.3, { w: 0.25 }),
  line(W - 1.3, 1.3, 1.3, H - 1.3, { w: 0.25 }),
])

save('column.svg', 305, 305, (W, H) => {
  const out = [rect(0.5, 0.5, W - 1, H - 1, { w: 0.5 })]
  const lo = 0.5
  const hi = W - 0.5
  for (let c = lo - hi + 1.5; c < hi - lo; c += 1.5) {
    const x1 = Math.max(lo, lo + c)
    const x2 = Math.min(hi, hi + c)
    if (x2 - x1 > 0.3) out.push(line(x1, x1 - c, x2, x2 - c, { w: 0.25 }))
  }
  return out
})

function car(file, wMm, dMm, spec) {
  save(file, wMm, dMm, (W, H) => {
    const cx = W / 2
    const bw = units(spec.body) / 2 - 0.5
    const top = 0.5
    const bot = H - 0.5
    const rr = spec.rearRound
    const fr = spec.frontRound
    const body = `M${num(cx - bw + rr)} ${top}L${num(cx + bw - rr)} ${top}Q${num(cx + bw)} ${top} ${num(cx + bw)} ${num(top + rr)}Q${num(cx + bw + 0.5)} ${num(H / 2)} ${num(cx + bw)} ${num(bot - fr)}Q${num(cx + bw)} ${num(bot)} ${num(cx + bw - fr)} ${num(bot)}L${num(cx - bw + fr)} ${num(bot)}Q${num(cx - bw)} ${num(bot)} ${num(cx - bw)} ${num(bot - fr)}Q${num(cx - bw - 0.5)} ${num(H / 2)} ${num(cx - bw)} ${num(top + rr)}Q${num(cx - bw)} ${top} ${num(cx - bw + rr)} ${top}Z`
    const { rear, roofFrom, roofTo, screen, cabin, screenWide, rearWide } = spec
    const mirror = (s) => {
      const x0 = cx + s * (bw - 0.5)
      const x1 = s > 0 ? W - 0.5 : 0.5
      const y = screen + 2
      return path(
        `M${num(x0)} ${num(y)}L${num(x1 - s * 0.8)} ${num(y + 1)}Q${num(x1)} ${num(y + 1.2)} ${num(x1)} ${num(y + 2.4)}L${num(x1)} ${num(y + 5.4)}Q${num(x1)} ${num(y + 6.6)} ${num(x1 - s * 1.2)} ${num(y + 6.4)}L${num(x0)} ${num(y + 6.6)}Z`,
      )
    }
    const out = [mirror(-1), mirror(1), path(body)]
    out.push(
      path(
        `M${num(cx - rearWide)} ${num(rear)}Q${num(cx)} ${num(rear - 3)} ${num(cx + rearWide)} ${num(rear)}L${num(cx + cabin)} ${num(roofFrom)}L${num(cx - cabin)} ${num(roofFrom)}Z`,
        { f: GREY },
      ),
    )
    out.push(
      path(
        `M${num(cx - cabin)} ${num(roofTo)}L${num(cx + cabin)} ${num(roofTo)}L${num(cx + screenWide)} ${num(screen)}Q${num(cx)} ${num(screen + 5)} ${num(cx - screenWide)} ${num(screen)}Z`,
        { f: GREY },
      ),
    )
    for (const s of [-1, 1]) {
      const edge = cx + s * (bw - 1.6)
      out.push(
        path(
          `M${num(cx + s * cabin)} ${num(roofFrom)}L${num(cx + s * rearWide)} ${num(rear)}L${num(edge)} ${num(rear + 4)}L${num(edge)} ${num(screen - 3)}L${num(cx + s * screenWide)} ${num(screen)}L${num(cx + s * cabin)} ${num(roofTo)}Z`,
          { f: GREY, w: 0.5 },
        ),
      )
      out.push(line(cx + s * cabin, spec.pillar, edge, spec.pillar))
      out.push(
        stroke(
          `M${num(cx + s * (screenWide - 6))} ${num(screen + 6)}Q${num(cx + s * (screenWide - 3))} ${num((screen + bot) / 2)} ${num(cx + s * (screenWide - 8))} ${num(bot - 4)}`,
        ),
      )
      out.push(
        path(
          `M${num(cx + s * (bw - 1))} ${num(bot - fr + 1)}Q${num(cx + s * (bw - 2))} ${num(bot - 2.2)} ${num(cx + s * (bw - fr * 0.9))} ${num(bot - 1.4)}L${num(cx + s * (bw - fr * 0.9 - 6))} ${num(bot - 1.6)}L${num(cx + s * (bw - fr * 0.9 - 5))} ${num(bot - 4.2)}Z`,
          { f: LIGHT, w: 0.5 },
        ),
      )
      out.push(
        path(
          `M${num(cx + s * (bw - 1.2))} ${num(top + rr * 0.7)}Q${num(cx + s * (bw - 1.6))} ${num(top + 1.4)} ${num(cx + s * (bw - rr))} ${num(top + 1.2)}L${num(cx + s * (bw - rr - 6))} ${num(top + 1.2)}L${num(cx + s * (bw - rr - 6))} ${num(top + 3)}L${num(cx + s * (bw - 1.2))} ${num(top + 4.5)}Z`,
          { f: GREY, w: 0.5 },
        ),
      )
    }
    out.push(rect(cx - cabin, roofFrom, cabin * 2, roofTo - roofFrom, { rx: 3 }))
    if (spec.rails) {
      for (const s of [-1, 1]) {
        const x = cx + s * (cabin - 3)
        out.push(
          rect(x - 0.7, roofFrom + 3, 1.4, roofTo - roofFrom - 6, { rx: 0.7, f: GREY, w: 0.5 }),
        )
      }
    }
    if (spec.trunk)
      out.push(
        stroke(
          `M${num(cx - bw + 3)} ${num(spec.trunk)}Q${num(cx)} ${num(spec.trunk - 2)} ${num(cx + bw - 3)} ${num(spec.trunk)}`,
        ),
      )
    return out
  })
}

car('sedan.svg', 2007, 4877, {
  body: 1820,
  rearRound: 9,
  frontRound: 13,
  rear: 36,
  roofFrom: 56,
  roofTo: 110,
  screen: 136,
  pillar: 86,
  cabin: 28,
  screenWide: 31.5,
  rearWide: 30,
  trunk: 4.5,
})
car('suv.svg', 2057, 4699, {
  body: 1900,
  rearRound: 6,
  frontRound: 10,
  rear: 7,
  roofFrom: 18,
  roofTo: 116,
  screen: 138,
  pillar: 70,
  cabin: 30,
  screenWide: 33,
  rearWide: 31,
  rails: true,
})

save('ping-pong.svg', 1829, 2743, (W, H) => {
  const tw = units(1525)
  const x0 = (W - tw) / 2
  const out = [
    rect(x0, 0.5, tw, H - 1),
    rect(x0 + 0.8, 1.3, tw - 1.6, H - 2.6, { f: 'none', w: 0.5 }),
    line(W / 2, 1.3, W / 2, H - 1.3),
  ]
  out.push(rect(0.5, H / 2 - 0.4, W - 1, 0.8, { f: INK, w: 0 }))
  out.push(rect(0.5, H / 2 - 1.4, 2.6, 2.8, { rx: 0.4, f: GREY }))
  out.push(rect(W - 3.1, H / 2 - 1.4, 2.6, 2.8, { rx: 0.4, f: GREY }))
  return out
})

save('pool-table.svg', 1626, 2896, (W, H) => {
  const rail = 5
  const out = [
    rect(0.5, 0.5, W - 1, H - 1, { rx: 2.5 }),
    rect(0.5 + rail, 0.5 + rail, W - 1 - 2 * rail, H - 1 - 2 * rail, { f: LIGHT, w: 0.5 }),
  ]
  const ix0 = 0.5 + rail
  const iy0 = 0.5 + rail
  const ix1 = W - 0.5 - rail
  const iy1 = H - 0.5 - rail
  for (const [x, y] of [
    [ix0, iy0],
    [ix1, iy0],
    [ix0, iy1],
    [ix1, iy1],
    [ix0 - 0.6, H / 2],
    [ix1 + 0.6, H / 2],
  ]) {
    out.push(circle(x, y, 2.3, { f: INK, w: 0 }))
  }
  const len = iy1 - iy0
  for (let i = 1; i < 8; i++) {
    if (i === 4) continue
    const y = iy0 + (len * i) / 8
    out.push(
      circle(ix0 - rail / 2, y, 0.4, { f: INK, w: 0 }),
      circle(ix1 + rail / 2, y, 0.4, { f: INK, w: 0 }),
    )
  }
  for (let i = 1; i < 4; i++) {
    const x = ix0 + ((ix1 - ix0) * i) / 4
    out.push(
      circle(x, iy0 - rail / 2, 0.4, { f: INK, w: 0 }),
      circle(x, iy1 + rail / 2, 0.4, { f: INK, w: 0 }),
    )
  }
  const head = iy1 - len / 4
  out.push(line(ix0, head, ix1, head, { w: 0.25, d: '1.5 1' }))
  out.push(circle(W / 2, head + 4, 1.12, { f: FINISH, w: 0.4 }))
  const foot = iy0 + len / 4
  const br = 1.12
  for (let row = 0; row < 5; row++) {
    for (let k = 0; k <= row; k++) {
      out.push(
        circle(W / 2 + (k - row / 2) * br * 2, foot - row * br * 1.75, br, { f: GREY, w: 0.4 }),
      )
    }
  }
  return out
})

save('bbq.svg', 1575, 762, (W, H) => {
  const out = []
  const shelfY = 2.5
  const shelfH = H - 6
  const lidX0 = 17
  const lidX1 = W - 17
  out.push(rect(0.5, shelfY, lidX0 + 1, shelfH, { rx: 1 }))
  out.push(rect(lidX1 - 1, shelfY, W - 0.5 - lidX1 + 1, shelfH, { rx: 1 }))
  for (let x = 3.5; x < lidX0 - 1; x += 3)
    out.push(line(x, shelfY + 1.5, x, shelfY + shelfH - 1.5, { w: 0.25 }))
  const bx = (lidX1 + W - 0.5) / 2
  const by = shelfY + shelfH / 2
  out.push(circle(bx, by, 6), circle(bx, by, 3.4, { f: GREY, w: 0.5 }))
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    out.push(
      line(
        bx + Math.cos(a) * 3.4,
        by + Math.sin(a) * 3.4,
        bx + Math.cos(a) * 6,
        by + Math.sin(a) * 6,
      ),
    )
  }
  const lidBottom = H - 4
  out.push(rect(lidX0, 0.5, lidX1 - lidX0, lidBottom - 0.5, { rx: 6 }))
  out.push(
    rect(lidX0 + 2.5, 2.5, lidX1 - lidX0 - 5, lidBottom - 4.5, { rx: 4.5, f: 'none', w: 0.5 }),
  )
  out.push(circle(W / 2, (lidBottom + 0.5) / 2, 1.4, { f: LIGHT, w: 0.5 }))
  out.push(
    line(lidX0 + 6, lidBottom, lidX0 + 6, H - 1.6),
    line(lidX1 - 6, lidBottom, lidX1 - 6, H - 1.6),
  )
  out.push(rect(lidX0 + 4, H - 2.4, lidX1 - lidX0 - 8, 1.9, { rx: 0.95, f: GREY }))
  return out
})

save('exercise-bike.svg', 610, 1321, (W, H) => {
  const cx = W / 2
  return [
    rect(1, 1, W - 2, 3, { rx: 1.5 }),
    rect(1, H - 4, W - 2, 3, { rx: 1.5 }),
    rect(cx - 2, 36, 4, 12.5, { rx: 2, f: LIGHT }),
    rect(cx - 1.4, 4, 2.8, H - 8, { f: GREY, w: 0.5 }),
    line(cx, 25, 3.5, 25, { w: 1 }),
    line(cx, 25, W - 3.5, 25, { w: 1 }),
    rect(1.2, 23.3, 4.6, 3.4, { rx: 0.6, f: GREY, w: 0.5 }),
    rect(W - 5.8, 23.3, 4.6, 3.4, { rx: 0.6, f: GREY, w: 0.5 }),
    circle(cx, 25, 2.2, { f: LIGHT, w: 0.5 }),
    path(
      `M${num(cx - 5)} 11C${num(cx - 5.4)} 14 ${num(cx - 2)} 16 ${num(cx - 1.4)} 20.5Q${num(cx)} 21.5 ${num(cx + 1.4)} 20.5C${num(cx + 2)} 16 ${num(cx + 5.4)} 14 ${num(cx + 5)} 11Q${num(cx)} 8.6 ${num(cx - 5)} 11Z`,
    ),
    stroke(
      `M2.5 33Q3 29.5 ${num(cx - 2)} 30.5L${num(cx + 2)} 30.5Q${num(W - 3)} 29.5 ${num(W - 2.5)} 33`,
      { w: 1.6 },
    ),
    rect(1.3, 32, 2.4, 5, { rx: 1.2 }),
    rect(W - 3.7, 32, 2.4, 5, { rx: 1.2 }),
    rect(cx - 4, 33, 8, 4.5, { rx: 0.8 }),
    rect(cx - 2.8, 34, 5.6, 2.5, { f: GREY, w: 0.5 }),
  ]
})

save('gym-bench.svg', 457, 1372, (W, H) => {
  const cx = W / 2
  return [
    rect(0.5, 1, W - 1, 2.6, { rx: 1.3, f: GREY }),
    rect(0.5, H - 3.6, W - 1, 2.6, { rx: 1.3, f: GREY }),
    rect(cx - 1.5, 3, 3, H - 6, { f: LIGHT, w: 0.5 }),
    rect(0.8, H - 9.5, 5.8, 3.4, { rx: 1.7 }),
    rect(W - 6.6, H - 9.5, 5.8, 3.4, { rx: 1.7 }),
    line(6.6, H - 7.8, W - 6.6, H - 7.8, { w: 1 }),
    rect(3.2, 2.2, W - 6.4, 30, { rx: 2 }),
    rect(4.2, 3.2, W - 8.4, 28, { rx: 1.4, f: 'none', w: 0.5 }),
    rect(3.2, 33.2, W - 6.4, 11.6, { rx: 2 }),
    rect(4.2, 34.2, W - 8.4, 9.6, { rx: 1.4, f: 'none', w: 0.5 }),
  ]
})

save('treadmill.svg', 889, 2032, (W, H) => [
  rect(1, 1, 2, 36, { rx: 1, f: GREY }),
  rect(W - 3, 1, 2, 36, { rx: 1, f: GREY }),
  rect(3, 8, W - 6, H - 8.5, { rx: 1.5 }),
  rect(8, 15, W - 16, H - 20, { f: GREY, w: 0.5 }),
  line(8, H - 5, W - 8, H - 5, { w: 0.5 }),
  rect(4, 6, W - 8, 9, { rx: 2 }),
  rect(0.5, 0.5, W - 1, 7.5, { rx: 2 }),
  rect(W / 2 - 7, 2, 14, 4, { rx: 0.6, f: LIGHT, w: 0.5 }),
  circle(5.5, 4.25, 1.3, { f: LIGHT, w: 0.5 }),
  circle(W - 5.5, 4.25, 1.3, { f: LIGHT, w: 0.5 }),
])

save('weight-rack.svg', 1194, 457, (W, H) => {
  const out = [rect(0.5, 0.5, W - 1, H - 1, { f: LIGHT, w: 0.5 })]
  out.push(rect(0.5, 0.5, 2.2, H - 1), rect(W - 2.7, 0.5, 2.2, H - 1))
  out.push(
    rect(2.7, 3.2, W - 5.4, 1.6, { f: FINISH, w: 0.5 }),
    rect(2.7, H - 4.8, W - 5.4, 1.6, { f: FINISH, w: 0.5 }),
  )
  const n = 6
  for (let i = 0; i < n; i++) {
    const x = 2.7 + ((W - 5.4) * (i + 0.5)) / n
    const s = 2.8 + i * 0.32
    out.push(rect(x - 0.5, 2, 1, H - 4, { rx: 0.5, f: GREY, w: 0.5 }))
    out.push(rect(x - s / 2, 1.2, s, s * 0.85 + 0.6, { rx: 0.5, f: INK, w: 0 }))
    out.push(
      rect(x - s / 2, H - 1.2 - (s * 0.85 + 0.6), s, s * 0.85 + 0.6, { rx: 0.5, f: INK, w: 0 }),
    )
  }
  return out
})

save('box.svg', 635, 432, (W, H) => [
  rect(0.5, 0.5, W - 1, H - 1),
  line(1.3, 1.3, 1.3, H - 1.3, { w: 0.25 }),
  line(W - 1.3, 1.3, W - 1.3, H - 1.3, { w: 0.25 }),
  rect(0.5, H / 2 - 1, W - 1, 2, { f: LIGHT, w: 0.5 }),
  line(1.3, H / 2, W - 1.3, H / 2, { w: 0.25 }),
])

save('camera.svg', 700, 700, (W, H) => [
  rect(3.5, 5, W - 7, 12, { rx: 1.6 }),
  rect(W / 2 - 4, 7.5, 8, 7, { rx: 0.8, f: LIGHT, w: 0.5 }),
  circle(7.6, 10, 1.8, { f: LIGHT, w: 0.5 }),
  circle(W - 7, 9, 1.2, { f: GREY, w: 0.5 }),
  rect(W / 2 - 5, 17, 10, 6, { f: GREY }),
  line(W / 2 - 5, 19, W / 2 + 5, 19),
  line(W / 2 - 5, 21, W / 2 + 5, 21),
  rect(W / 2 - 6, 23, 12, 2.6, { rx: 0.6 }),
  stroke(
    `M${num(W / 2 - 6)} 25.6L1 ${num(H - 0.5)}M${num(W / 2 + 6)} 25.6L${num(W - 1)} ${num(H - 0.5)}`,
    { d: '1 1' },
  ),
])

console.log('outdoor-gym-misc symbols written to', OUT)
