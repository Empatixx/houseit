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
    rect(0.5, 0.5, W - 1, H - 1, { rx: 3.5 }),
    rect(0.5 + t, 0.5 + t, W - 1 - 2 * t, H - 1 - 2 * t, { f: LIGHT, w: 0.5, rx: 1.5 }),
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
        out.push(circle(fx, fy, 0.3, { f: GREY, w: 0 }))
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
  const bend = (y, k) =>
    `M${num(-cw / 2 + 3)} ${num(y)}Q0 ${num(y + k)} ${num(cw / 2 - 3)} ${num(y)}`
  const back = cd / 2
  const chair = [
    rect(-cw / 2 + 0.5, -cd / 2, cw - 1, cd - 1.5, { rx: 4 }),
    [-5, -1, 3].map((y) => stroke(bend(y, 1.6))),
    path(
      `M${num(-cw / 2)} ${num(back - 3.2)}Q0 ${num(back + 0.5)} ${num(cw / 2)} ${num(back - 3.2)}Q${num(cw / 2 + 0.2)} ${num(back - 5.6)} ${num(cw / 2 - 1.4)} ${num(back - 5.6)}Q0 ${num(back - 2.4)} ${num(-cw / 2 + 1.4)} ${num(back - 5.6)}Q${num(-cw / 2 - 0.2)} ${num(back - 5.6)} ${num(-cw / 2)} ${num(back - 3.2)}Z`,
    ),
    rect(-cw / 2, -cd / 2 + 3, 2.2, cd - 8, { rx: 1.1 }),
    rect(cw / 2 - 2.2, -cd / 2 + 3, 2.2, cd - 8, { rx: 1.1 }),
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
  const scallop = pts.map((p, i) => {
    const q = pts[(i + 1) % 8]
    const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
    const k = 1.05
    return `Q${num(cx + (m[0] - cx) * k)} ${num(cy + (m[1] - cy) * k)} ${num(q[0])} ${num(q[1])}`
  })
  out.push(stroke(`M${num(pts[0][0])} ${num(pts[0][1])}${scallop.join('')}Z`, { d: '3 2' }))
  for (const p of pts) out.push(line(cx, cy, p[0], p[1], { d: '3 2' }))
  out.push(circle(cx, cy, 1.6, { f: GREY, w: 0.5 }))
  return out
})

save('yoga-mat.svg', 610, 1727, (W, H) => [
  rect(0.5, 0.5, W - 1, H - 1, { rx: 1.6 }),
  rect(0.5, 0.5, W - 1, 5.6, { rx: 2.8 }),
  stroke(
    `M1.6 2.4Q${num(W / 2)} 2.9 ${num(W - 1.6)} 2.4M1.6 4Q${num(W / 2)} 4.5 ${num(W - 1.6)} 4`,
  ),
  rect(1.9, 7.4, W - 3.8, H - 9.3, { f: 'none', w: 0.5, rx: 1 }),
])

save('railing.svg', 2311, 127, (W, H) => {
  const posts = 4
  const out = [rect(0.5, H / 2 - 1.2, W - 1, 2.4, { rx: 1.2 })]
  for (let i = 0; i < posts; i++) {
    const x = 2.5 + ((W - 5) * i) / (posts - 1)
    out.push(circle(x, H / 2, 1.9, { f: GREY, w: 0.5 }))
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
    const bw = units(spec.body) / 2 - 1
    const top = 0.5
    const bot = H - 0.5
    const { rr, fr, rear, roofFrom, roofTo, screen, cabin, screenWide, rearWide } = spec
    const side = (s) => cx + s * bw
    const body =
      `M${num(cx)} ${top}` +
      `C${num(cx + bw * 0.55)} ${top} ${num(side(1))} ${num(top + rr * 0.2)} ${num(side(1))} ${num(top + rr)}` +
      `C${num(side(1) + 0.9)} ${num(H * 0.35)} ${num(side(1) + 0.9)} ${num(H * 0.65)} ${num(side(1))} ${num(bot - fr)}` +
      `C${num(side(1))} ${num(bot - fr * 0.2)} ${num(cx + bw * 0.55)} ${bot} ${num(cx)} ${bot}` +
      `C${num(cx - bw * 0.55)} ${bot} ${num(side(-1))} ${num(bot - fr * 0.2)} ${num(side(-1))} ${num(bot - fr)}` +
      `C${num(side(-1) - 0.9)} ${num(H * 0.65)} ${num(side(-1) - 0.9)} ${num(H * 0.35)} ${num(side(-1))} ${num(top + rr)}` +
      `C${num(side(-1))} ${num(top + rr * 0.2)} ${num(cx - bw * 0.55)} ${top} ${num(cx)} ${top}Z`
    const mirror = (s) => {
      const x0 = side(s) - s * 0.6
      const x1 = s > 0 ? W - 0.5 : 0.5
      const y = screen + 1
      return path(
        `M${num(x0)} ${num(y)}C${num(x1 - s * 1.6)} ${num(y)} ${num(x1)} ${num(y + 0.8)} ${num(x1)} ${num(y + 3)}C${num(x1)} ${num(y + 5.4)} ${num(x1 - s * 2)} ${num(y + 6.2)} ${num(x0)} ${num(y + 6.6)}Z`,
      )
    }
    const out = [mirror(-1), mirror(1), path(body)]
    for (const s of [-1, 1]) {
      const edge = cx + s * (bw - 2)
      out.push(
        path(
          `M${num(cx + s * cabin)} ${num(roofFrom)}L${num(cx + s * rearWide)} ${num(rear)}Q${num(edge)} ${num(rear + 0.6)} ${num(edge)} ${num(rear + 5)}L${num(edge)} ${num(screen - 5)}Q${num(edge)} ${num(screen - 0.4)} ${num(cx + s * screenWide)} ${num(screen)}L${num(cx + s * cabin)} ${num(roofTo)}Z`,
          { f: GREY, w: 0.5 },
        ),
      )
      out.push(
        stroke(`M${num(cx + s * cabin)} ${num(spec.pillar)}L${num(edge)} ${num(spec.pillar + 1)}`),
      )
      out.push(
        stroke(
          `M${num(cx + s * (screenWide - 6))} ${num(screen + 7)}Q${num(cx + s * (screenWide - 3))} ${num((screen + bot) / 2)} ${num(cx + s * (screenWide - 9))} ${num(bot - 5)}`,
        ),
      )
      out.push(
        path(
          `M${num(side(s) - s * 1.3)} ${num(bot - fr * 0.75)}Q${num(side(s) - s * 1.6)} ${num(bot - 2.4)} ${num(cx + s * bw * 0.6)} ${num(bot - 1.9)}Q${num(cx + s * bw * 0.52)} ${num(bot - 3.6)} ${num(cx + s * bw * 0.62)} ${num(bot - 4.2)}Q${num(side(s) - s * 4)} ${num(bot - 4.8)} ${num(side(s) - s * 1.3)} ${num(bot - fr * 0.75)}Z`,
          { f: LIGHT, w: 0.5 },
        ),
      )
      out.push(
        path(
          `M${num(side(s) - s * 1.2)} ${num(top + rr * 0.7)}Q${num(side(s) - s * 1.8)} ${num(top + 1.8)} ${num(cx + s * bw * 0.6)} ${num(top + 1.5)}Q${num(cx + s * bw * 0.55)} ${num(top + 3)} ${num(cx + s * bw * 0.65)} ${num(top + 3.3)}Q${num(side(s) - s * 3)} ${num(top + 3.6)} ${num(side(s) - s * 1.2)} ${num(top + rr * 0.7 + 2)}Z`,
          { f: GREY, w: 0.5 },
        ),
      )
    }
    out.push(
      path(
        `M${num(cx - rearWide)} ${num(rear)}Q${num(cx)} ${num(rear - 4)} ${num(cx + rearWide)} ${num(rear)}L${num(cx + cabin)} ${num(roofFrom)}Q${num(cx)} ${num(roofFrom - 2.5)} ${num(cx - cabin)} ${num(roofFrom)}Z`,
        { f: GREY },
      ),
    )
    out.push(
      path(
        `M${num(cx - cabin)} ${num(roofTo)}Q${num(cx)} ${num(roofTo - 2.5)} ${num(cx + cabin)} ${num(roofTo)}L${num(cx + screenWide)} ${num(screen)}Q${num(cx)} ${num(screen + 6)} ${num(cx - screenWide)} ${num(screen)}Z`,
        { f: GREY },
      ),
    )
    const third = (roofTo - roofFrom) / 3
    out.push(
      path(
        `M${num(cx - cabin)} ${num(roofFrom)}Q${num(cx)} ${num(roofFrom - 2.5)} ${num(cx + cabin)} ${num(roofFrom)}C${num(cx + cabin + 0.6)} ${num(roofFrom + third)} ${num(cx + cabin + 0.6)} ${num(roofTo - third)} ${num(cx + cabin)} ${num(roofTo)}Q${num(cx)} ${num(roofTo - 2.5)} ${num(cx - cabin)} ${num(roofTo)}C${num(cx - cabin - 0.6)} ${num(roofTo - third)} ${num(cx - cabin - 0.6)} ${num(roofFrom + third)} ${num(cx - cabin)} ${num(roofFrom)}Z`,
      ),
    )
    if (spec.rails) {
      for (const s of [-1, 1]) {
        const x = cx + s * (cabin - 3)
        out.push(
          rect(x - 0.7, roofFrom + 3, 1.4, roofTo - roofFrom - 6, { rx: 0.7, f: GREY, w: 0.5 }),
        )
      }
    }
    return out
  })
}

car('sedan.svg', 2007, 4877, {
  body: 1820,
  rr: 16,
  fr: 20,
  rear: 36,
  roofFrom: 58,
  roofTo: 108,
  screen: 136,
  pillar: 84,
  cabin: 27,
  screenWide: 31,
  rearWide: 29.5,
})
car('suv.svg', 2057, 4699, {
  body: 1900,
  rr: 11,
  fr: 16,
  rear: 9,
  roofFrom: 20,
  roofTo: 114,
  screen: 138,
  pillar: 66,
  cabin: 29.5,
  screenWide: 32.5,
  rearWide: 31,
  rails: true,
})

save('ping-pong.svg', 1829, 2743, (W, H) => {
  const tw = units(1525)
  const x0 = (W - tw) / 2
  return [
    rect(x0, 0.5, tw, H - 1, { rx: 2.5 }),
    rect(x0 + 0.9, 1.4, tw - 1.8, H - 2.8, { f: 'none', w: 0.5, rx: 1.7 }),
    line(W / 2, 1.4, W / 2, H - 1.4),
    rect(1.6, H / 2 - 0.55, W - 3.2, 1.1, { rx: 0.55, f: LIGHT, w: 0.5 }),
    line(2.4, H / 2, W - 2.4, H / 2, { w: 0.25, d: '0.5 0.5' }),
    circle(1.8, H / 2, 1.3, { f: GREY, w: 0.5 }),
    circle(W - 1.8, H / 2, 1.3, { f: GREY, w: 0.5 }),
  ]
})

save('pool-table.svg', 1626, 2896, (W, H) => {
  const rail = 5
  const ix0 = 0.5 + rail
  const iy0 = 0.5 + rail
  const ix1 = W - 0.5 - rail
  const iy1 = H - 0.5 - rail
  const out = [
    rect(0.5, 0.5, W - 1, H - 1, { rx: 5.5 }),
    rect(ix0, iy0, ix1 - ix0, iy1 - iy0, { f: LIGHT, w: 0.5, rx: 1.5 }),
  ]
  for (const [x, y] of [
    [ix0 + 0.4, iy0 + 0.4],
    [ix1 - 0.4, iy0 + 0.4],
    [ix0 + 0.4, iy1 - 0.4],
    [ix1 - 0.4, iy1 - 0.4],
    [ix0 - 0.9, H / 2],
    [ix1 + 0.9, H / 2],
  ]) {
    out.push(circle(x, y, 2.5, { f: GREY }), circle(x, y, 1.5, { f: 'none', w: 0.5 }))
  }
  const len = iy1 - iy0
  const diamond = (x, y) => circle(x, y, 0.45, { f: LIGHT, w: 0.25 })
  for (let i = 1; i < 8; i++) {
    if (i === 4) continue
    const y = iy0 + (len * i) / 8
    out.push(diamond(ix0 - rail / 2, y), diamond(ix1 + rail / 2, y))
  }
  for (let i = 1; i < 4; i++) {
    const x = ix0 + ((ix1 - ix0) * i) / 4
    out.push(diamond(x, iy0 - rail / 2), diamond(x, iy1 + rail / 2))
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
  out.push(
    circle(6, shelfY + shelfH + 0.6, 1.2, { f: LIGHT, w: 0.5 }),
    circle(11.5, shelfY + shelfH + 0.6, 1.2, { f: LIGHT, w: 0.5 }),
  )
  out.push(rect(0.5, shelfY, lidX0 + 1.5, shelfH, { rx: 2.5 }))
  out.push(rect(lidX1 - 2, shelfY, W - 0.5 - lidX1 + 2, shelfH, { rx: 2.5 }))
  for (let x = 4; x < lidX0 - 1; x += 3) out.push(line(x, shelfY + 2, x, shelfY + shelfH - 2))
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
  out.push(
    line(lidX0 + 6, lidBottom - 1, lidX0 + 6, H - 1.6),
    line(lidX1 - 6, lidBottom - 1, lidX1 - 6, H - 1.6),
  )
  out.push(rect(lidX0, 0.5, lidX1 - lidX0, lidBottom - 0.5, { rx: 8 }))
  out.push(rect(lidX0 + 2.5, 2.5, lidX1 - lidX0 - 5, lidBottom - 4.5, { rx: 6, f: 'none', w: 0.5 }))
  out.push(circle(W / 2, (lidBottom + 0.5) / 2, 1.4, { f: LIGHT, w: 0.5 }))
  out.push(rect(lidX0 + 4, H - 2.4, lidX1 - lidX0 - 8, 1.9, { rx: 0.95, f: GREY }))
  return out
})

save('exercise-bike.svg', 610, 1321, (W, H) => {
  const cx = W / 2
  return [
    rect(1, 1, W - 2, 3, { rx: 1.5 }),
    rect(1, H - 4, W - 2, 3, { rx: 1.5 }),
    ellipse(cx, 42.5, 2.2, 6.6, { f: LIGHT }),
    rect(cx - 1.4, 4, 2.8, H - 8, { rx: 1.4, f: GREY, w: 0.5 }),
    line(cx, 25, 3.8, 25, { w: 1 }),
    line(cx, 25, W - 3.8, 25, { w: 1 }),
    rect(1.2, 23.2, 4.6, 3.6, { rx: 1.8, f: GREY, w: 0.5 }),
    rect(W - 5.8, 23.2, 4.6, 3.6, { rx: 1.8, f: GREY, w: 0.5 }),
    circle(cx, 25, 2.2, { f: LIGHT, w: 0.5 }),
    path(
      `M${num(cx - 5)} 11C${num(cx - 5.4)} 14 ${num(cx - 2)} 16 ${num(cx - 1.4)} 20.5Q${num(cx)} 21.5 ${num(cx + 1.4)} 20.5C${num(cx + 2)} 16 ${num(cx + 5.4)} 14 ${num(cx + 5)} 11Q${num(cx)} 8.6 ${num(cx - 5)} 11Z`,
    ),
    stroke(`M${num(cx)} 12.5L${num(cx)} 19`),
    path(
      `M2.3 33.5C2.3 29.8 4.5 29.6 ${num(cx)} 29.8C${num(W - 4.5)} 29.6 ${num(W - 2.3)} 29.8 ${num(W - 2.3)} 33.5L${num(W - 3.7)} 33.5C${num(W - 3.7)} 31.4 ${num(W - 5)} 31.3 ${num(cx)} 31.4C5 31.3 3.7 31.4 3.7 33.5Z`,
    ),
    rect(1.3, 32, 2.4, 5.4, { rx: 1.2 }),
    rect(W - 3.7, 32, 2.4, 5.4, { rx: 1.2 }),
    rect(cx - 4, 33, 8, 4.6, { rx: 2 }),
    rect(cx - 2.8, 34, 5.6, 2.6, { rx: 0.8, f: GREY, w: 0.5 }),
  ]
})

save('gym-bench.svg', 457, 1372, (W, H) => {
  const cx = W / 2
  const pad = (y0, y1, taper) =>
    `M${num(3.2 + taper)} ${num(y0 + 4)}Q${num(3.2 + taper)} ${num(y0)} ${num(cx)} ${num(y0)}Q${num(W - 3.2 - taper)} ${num(y0)} ${num(W - 3.2 - taper)} ${num(y0 + 4)}L${num(W - 3.2)} ${num(y1 - 3.5)}Q${num(W - 3.2)} ${num(y1)} ${num(cx)} ${num(y1)}Q3.2 ${num(y1)} 3.2 ${num(y1 - 3.5)}Z`
  return [
    rect(0.5, 1, W - 1, 2.6, { rx: 1.3, f: GREY }),
    rect(0.5, H - 3.6, W - 1, 2.6, { rx: 1.3, f: GREY }),
    rect(cx - 1.5, 3, 3, H - 6, { rx: 1, f: LIGHT, w: 0.5 }),
    line(6.6, H - 7.8, W - 6.6, H - 7.8, { w: 1 }),
    rect(0.8, H - 9.6, 5.8, 3.6, { rx: 1.8 }),
    rect(W - 6.6, H - 9.6, 5.8, 3.6, { rx: 1.8 }),
    path(pad(2.2, 32.2, 1.2)),
    stroke(`M${num(cx)} 6L${num(cx)} 29`),
    path(pad(33.4, 45, 0.4)),
    stroke(`M6 39.2L${num(W - 6)} 39.2`),
  ]
})

save('treadmill.svg', 889, 2032, (W, H) => [
  rect(0.8, 3, 2.2, 34, { rx: 1.1, f: GREY }),
  rect(W - 3, 3, 2.2, 34, { rx: 1.1, f: GREY }),
  rect(3, 7, W - 6, H - 7.5, { rx: 3.5 }),
  rect(8, 15, W - 16, H - 21, { rx: 1.5, f: GREY, w: 0.5 }),
  stroke(`M8 ${num(H - 4.5)}Q${num(W / 2)} ${num(H - 3.4)} ${num(W - 8)} ${num(H - 4.5)}`),
  rect(4, 5, W - 8, 10, { rx: 3.5 }),
  path(
    `M3 0.5L${num(W - 3)} 0.5Q${num(W - 0.5)} 0.5 ${num(W - 0.5)} 3L${num(W - 0.5)} 5.2Q${num(W / 2)} 11 0.5 5.2L0.5 3Q0.5 0.5 3 0.5Z`,
  ),
  rect(W / 2 - 7, 2, 14, 4, { rx: 1.4, f: LIGHT, w: 0.5 }),
  circle(5.5, 3.6, 1.3, { f: LIGHT, w: 0.5 }),
  circle(W - 5.5, 3.6, 1.3, { f: LIGHT, w: 0.5 }),
])

save('weight-rack.svg', 1194, 457, (W, H) => {
  const out = [rect(0.5, 0.5, W - 1, H - 1, { f: LIGHT, w: 0.5, rx: 1.5 })]
  out.push(rect(0.5, 0.5, 2.4, H - 1, { rx: 1.2 }), rect(W - 2.9, 0.5, 2.4, H - 1, { rx: 1.2 }))
  out.push(
    rect(2.9, 3.2, W - 5.8, 1.6, { f: FINISH, w: 0.5, rx: 0.8 }),
    rect(2.9, H - 4.8, W - 5.8, 1.6, { f: FINISH, w: 0.5, rx: 0.8 }),
  )
  const n = 6
  for (let i = 0; i < n; i++) {
    const x = 2.9 + ((W - 5.8) * (i + 0.5)) / n
    const s = 2.8 + i * 0.32
    const h = s * 0.85 + 0.6
    out.push(rect(x - 0.5, 2, 1, H - 4, { rx: 0.5, f: GREY, w: 0.5 }))
    for (const y of [1.2, H - 1.2 - h]) {
      out.push(rect(x - s / 2, y, s, h, { rx: s * 0.35, f: GREY, w: 0.5 }))
      out.push(line(x - s / 2 + 0.4, y + h / 2, x + s / 2 - 0.4, y + h / 2, { w: 0.25 }))
    }
  }
  return out
})

save('box.svg', 635, 432, (W, H) => [
  rect(0.5, 0.5, W - 1, H - 1, { rx: 0.9 }),
  rect(0.5, H / 2 - 1, W - 1, 2, { f: LIGHT, w: 0.5 }),
  line(1.3, H / 2, W - 1.3, H / 2, { w: 0.25 }),
  line(1.4, 1.6, 1.4, H / 2 - 1, { w: 0.25 }),
  line(1.4, H / 2 + 1, 1.4, H - 1.6, { w: 0.25 }),
  line(W - 1.4, 1.6, W - 1.4, H / 2 - 1, { w: 0.25 }),
  line(W - 1.4, H / 2 + 1, W - 1.4, H - 1.6, { w: 0.25 }),
])

save('camera.svg', 700, 700, (W, H) => [
  rect(3.5, 5, W - 7, 12.5, { rx: 3.5 }),
  path(
    `M${num(W / 2 - 4.5)} 8.5Q${num(W / 2 - 4.5)} 6.5 ${num(W / 2 - 2.5)} 6.5L${num(W / 2 + 2.5)} 6.5Q${num(W / 2 + 4.5)} 6.5 ${num(W / 2 + 4.5)} 8.5L${num(W / 2 + 4)} 13.5Q${num(W / 2)} 15 ${num(W / 2 - 4)} 13.5Z`,
    { f: LIGHT, w: 0.5 },
  ),
  circle(7.8, 10.5, 2, { f: LIGHT, w: 0.5 }),
  circle(7.8, 10.5, 0.8, { f: 'none', w: 0.5 }),
  circle(W - 7.4, 9.5, 1.3, { f: GREY, w: 0.5 }),
  rect(W / 2 - 5, 16.5, 10, 7, { rx: 1.2, f: GREY }),
  stroke(
    `M${num(W / 2 - 5)} 19.2L${num(W / 2 + 5)} 19.2M${num(W / 2 - 5)} 21.4L${num(W / 2 + 5)} 21.4`,
  ),
  rect(W / 2 - 6, 23, 12, 2.8, { rx: 1.4 }),
  stroke(
    `M${num(W / 2 - 5.5)} 25.9L1 ${num(H - 0.5)}M${num(W / 2 + 5.5)} 25.9L${num(W - 1)} ${num(H - 0.5)}`,
    { d: '1 1' },
  ),
])

console.log('outdoor-gym-misc symbols written to', OUT)
