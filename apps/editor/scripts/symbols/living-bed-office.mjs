import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../public/symbols')

const MM = 25.4
const E = 12.7
const INK = '#212121'
const WHITE = '#ffffff'
const LIGHT = '#e9e9e9'
const GREY = '#d6d6d6'
const GRAIN = '#000000'
const SEAM = '#8c8c8c'

const n = (mm) => String(+(mm / MM).toFixed(2))
const d = (strings, ...values) =>
  strings.reduce((out, s, i) => out + s + (i < values.length ? n(values[i]) : ''), '')

function style({ fill = WHITE, sw = 1, dash, stroke = INK, opacity } = {}) {
  let s = `fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"`
  if (dash) s += ` stroke-dasharray="${dash}"`
  if (opacity) s += ` stroke-opacity="${opacity}"`
  return s
}
const IN = { sw: 0.5 }
const LINE = { fill: 'none', sw: 0.5 }
const FAINT = { fill: 'none', sw: 0.3, stroke: SEAM }
const HIDDEN = { fill: 'none', sw: 0.5, dash: '2 1.5' }
const WOOD = { fill: 'none', sw: 0.3, stroke: GRAIN, opacity: 0.14 }

const circle = (cx, cy, r, o = {}) =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" ${style(o)}/>`
const ellipse = (cx, cy, rx, ry, o = {}) =>
  `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" ${style(o)}/>`
const line = (x1, y1, x2, y2, o = LINE) =>
  `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" ${style({ ...LINE, ...o, fill: 'none' })}/>`
const path = (p, o = {}) => `<path d="${p}" ${style(o)}/>`
const group = (tx, ty, rot, body) =>
  `<g transform="translate(${n(tx)} ${n(ty)})${rot ? ` rotate(${rot})` : ''}">${body.join('')}</g>`

function softPath(x, y, w, h, r, bulge) {
  const [tl, tr, br, bl] = (Array.isArray(r) ? r : [r, r, r, r]).map((c) =>
    Math.min(c, w / 2, h / 2),
  )
  const b = bulge ?? Math.min(w, h) * 0.035
  const i = b * 0.75
  x += i
  y += i
  w -= 2 * i
  h -= 2 * i
  const k = 0.45
  const side = (a, z) => (z - a) / 3
  const tx = side(x + tl, x + w - tr)
  const ry = side(y + tr, y + h - br)
  const bx = side(x + bl, x + w - br)
  const ly = side(y + tl, y + h - bl)
  return (
    d`M${x + tl} ${y}C${x + tl + tx} ${y - b} ${x + w - tr - tx} ${y - b} ${x + w - tr} ${y}` +
    d`C${x + w - tr * k} ${y} ${x + w} ${y + tr * k} ${x + w} ${y + tr}` +
    d`C${x + w + b} ${y + tr + ry} ${x + w + b} ${y + h - br - ry} ${x + w} ${y + h - br}` +
    d`C${x + w} ${y + h - br * k} ${x + w - br * k} ${y + h} ${x + w - br} ${y + h}` +
    d`C${x + w - br - bx} ${y + h + b} ${x + bl + bx} ${y + h + b} ${x + bl} ${y + h}` +
    d`C${x + bl * k} ${y + h} ${x} ${y + h - bl * k} ${x} ${y + h - bl}` +
    d`C${x - b} ${y + h - bl - ly} ${x - b} ${y + tl + ly} ${x} ${y + tl}` +
    d`C${x} ${y + tl * k} ${x + tl * k} ${y} ${x + tl} ${y}Z`
  )
}
const soft = (x, y, w, h, r, o = {}, bulge) => path(softPath(x, y, w, h, r, bulge), o)
const rr = (x, y, w, h, r, o = {}) =>
  path(
    roundedPath(
      [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ],
      Array.isArray(r) ? r : [r, r, r, r],
    ),
    o,
  )
const rrBox = (x0, y0, x1, y1, r, o) => rr(x0, y0, x1 - x0, y1 - y0, r, o)

function roundedPath(points, radii) {
  const count = points.length
  const radius = (i) => (Array.isArray(radii) ? radii[i] : radii)
  const ends = points.map((p, i) => {
    const prev = points[(i + count - 1) % count]
    const next = points[(i + 1) % count]
    const l0 = Math.hypot(prev[0] - p[0], prev[1] - p[1])
    const l1 = Math.hypot(next[0] - p[0], next[1] - p[1])
    const r = Math.min(radius(i), l0 / 2, l1 / 2)
    return {
      a: [p[0] + ((prev[0] - p[0]) * r) / l0, p[1] + ((prev[1] - p[1]) * r) / l0],
      b: [p[0] + ((next[0] - p[0]) * r) / l1, p[1] + ((next[1] - p[1]) * r) / l1],
    }
  })
  let s = d`M${ends[0].b[0]} ${ends[0].b[1]}`
  for (let k = 1; k <= count; k++) {
    const i = k % count
    const p = points[i]
    s += d`L${ends[i].a[0]} ${ends[i].a[1]}Q${p[0]} ${p[1]} ${ends[i].b[0]} ${ends[i].b[1]}`
  }
  return `${s}Z`
}
const rounded = (points, radii, o = {}) => path(roundedPath(points, radii), o)

function pillowPath(x, y, w, h, puff) {
  const px = puff
  const py = puff * 0.8
  const x0 = x + px
  const y0 = y + py
  const x1 = x + w - px
  const y1 = y + h - py
  const c = 18
  return (
    d`M${x0 + c} ${y0}` +
    d`C${x0 + w * 0.3} ${y0 - py} ${x1 - w * 0.3} ${y0 - py} ${x1 - c} ${y0}` +
    d`Q${x1} ${y0} ${x1} ${y0 + c}` +
    d`C${x1 + px} ${y0 + h * 0.3} ${x1 + px} ${y1 - h * 0.3} ${x1} ${y1 - c}` +
    d`Q${x1} ${y1} ${x1 - c} ${y1}` +
    d`C${x1 - w * 0.3} ${y1 + py} ${x0 + w * 0.3} ${y1 + py} ${x0 + c} ${y1}` +
    d`Q${x0} ${y1} ${x0} ${y1 - c}` +
    d`C${x0 - px} ${y1 - h * 0.3} ${x0 - px} ${y0 + h * 0.3} ${x0} ${y0 + c}` +
    d`Q${x0} ${y0} ${x0 + c} ${y0}Z`
  )
}

function pillow(x, y, w, h) {
  const puff = Math.min(w, h) * 0.07
  return [
    path(pillowPath(x, y, w, h, puff), IN),
    path(
      d`M${x + puff + 40} ${y + puff + 30}Q${x + w * 0.5} ${y + h * 0.42} ${x + w - puff - 40} ${y + puff + 30}`,
      FAINT,
    ),
    path(
      d`M${x + puff + 45} ${y + h - puff - 35}Q${x + w * 0.5} ${y + h * 0.62} ${x + w - puff - 45} ${y + h - puff - 35}`,
      FAINT,
    ),
  ]
}

function seed(i) {
  const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453
  return s - Math.floor(s)
}

function grain(x0, y0, x1, y1, count, salt = 1) {
  const out = []
  const len = x1 - x0
  for (let i = 0; i < count; i++) {
    const y = y0 + ((y1 - y0) * (i + 0.5 + (seed(i + salt) - 0.5) * 0.5)) / count
    const a = 6 + seed(i * 3 + salt) * 10
    const sx = x0 + len * (0.05 + seed(i * 7 + salt) * 0.1)
    const ex = x1 - len * (0.05 + seed(i * 5 + salt) * 0.1)
    const m1 = sx + (ex - sx) * 0.33
    const m2 = sx + (ex - sx) * 0.66
    out.push(
      path(
        d`M${sx} ${y}C${m1} ${y - a} ${m1} ${y + a} ${(sx + ex) / 2} ${y}S${m2 + 60} ${y - a} ${ex} ${y + a * 0.3}`,
        WOOD,
      ),
    )
  }
  return out
}

const symbols = new Map()
function symbol(file, w, h, draw) {
  symbols.set(file, { w, h, body: draw(w, h) })
}

function write() {
  for (const [file, { w, h, body }] of symbols) {
    const W = n(w)
    const H = n(h)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none">\n${body
      .flat(Infinity)
      .join('\n')}\n</svg>\n`
    writeFileSync(resolve(OUT, file), svg)
  }
  console.log(`wrote ${symbols.size} symbols to ${OUT}`)
}

function duvet(x0, top, x1, bottom, { fold = 260, drape = true } = {}) {
  const w = x1 - x0
  const out = []
  out.push(
    path(
      d`M${x0} ${top + 20}C${x0 + w * 0.3} ${top - 15} ${x0 + w * 0.6} ${top + 35} ${x1} ${top + 10}` +
        d`C${x1 + 8} ${top + (bottom - top) * 0.4} ${x1 + 8} ${bottom - 200} ${x1} ${bottom - 90}` +
        d`Q${x1} ${bottom} ${x1 - 90} ${bottom}L${x0 + 90} ${bottom}Q${x0} ${bottom} ${x0} ${bottom - 90}` +
        d`C${x0 - 8} ${bottom - 200} ${x0 - 8} ${top + (bottom - top) * 0.4} ${x0} ${top + 20}Z`,
      IN,
    ),
  )
  const fy = top + fold
  out.push(
    path(
      d`M${x0} ${fy + 15}C${x0 + w * 0.25} ${fy - 20} ${x0 + w * 0.55} ${fy + 30} ${x1} ${fy}`,
      LINE,
    ),
  )
  if (drape) {
    out.push(
      path(
        d`M${x1 - w * 0.22} ${fy + 4}C${x1 - w * 0.12} ${fy + 60} ${x1 - 30} ${fy + 140} ${x1 + 2} ${fy + 230}` +
          d`L${x1 + 2} ${fy}Z`,
        { fill: LIGHT, sw: 0.5 },
      ),
    )
  }
  const len = bottom - fy
  out.push(
    path(
      d`M${x0 + w * 0.18} ${fy + len * 0.25}C${x0 + w * 0.3} ${fy + len * 0.45} ${x0 + w * 0.22} ${fy + len * 0.7} ${x0 + w * 0.34} ${bottom - 60}`,
      FAINT,
    ),
  )
  out.push(
    path(
      d`M${x0 + w * 0.62} ${fy + len * 0.3}C${x0 + w * 0.55} ${fy + len * 0.5} ${x0 + w * 0.7} ${fy + len * 0.62} ${x0 + w * 0.64} ${bottom - 140}`,
      FAINT,
    ),
  )
  if (w > 1000) {
    out.push(
      path(
        d`M${x0 + w * 0.85} ${fy + len * 0.45}C${x0 + w * 0.8} ${fy + len * 0.6} ${x0 + w * 0.88} ${fy + len * 0.75} ${x0 + w * 0.82} ${bottom - 40}`,
        FAINT,
      ),
    )
  }
  return out
}

function bed(w, h, { pillows }) {
  const head = 105
  const mx = E + 30
  const mb = h - E - 25
  const out = [rr(E, E + 30, w - 2 * E, h - 2 * E - 30, 70)]
  out.push(rrBox(mx, E + head - 10, w - mx, mb, 70, IN))
  out.push(rr(E, E, w - 2 * E, head, [50, 50, 30, 30]))
  for (let x = E + 110; x < w - E - 80; x += 120) out.push(line(x, E + 22, x, E + head - 22, FAINT))
  const mw = w - 2 * mx
  const pd = 440
  const pw = Math.min(720, (mw - (pillows + 1) * 50) / pillows)
  const gap = (mw - pillows * pw) / (pillows + 1)
  const py = E + head + 35
  for (let i = 0; i < pillows; i++) out.push(pillow(mx + gap + i * (pw + gap), py, pw, pd))
  out.push(duvet(mx - 16, py + pd + 90, w - mx + 16, mb + 10))
  return out
}

function chair(cx, cy, rot, w = 440, h = 460) {
  const hw = w / 2
  const y0 = -h / 2
  const seat = rounded(
    [
      [-hw + 55, y0 + 70],
      [hw - 55, y0 + 70],
      [hw - 12, y0 + h - 12],
      [-hw + 12, y0 + h - 12],
    ],
    [40, 40, 110, 110],
  )
  const pad = rounded(
    [
      [-hw + 95, y0 + 120],
      [hw - 95, y0 + 120],
      [hw - 55, y0 + h - 55],
      [-hw + 55, y0 + h - 55],
    ],
    [30, 30, 80, 80],
    { ...IN },
  )
  const back = path(
    d`M${-hw + 18} ${y0 + 62}Q${0} ${y0 - 22} ${hw - 18} ${y0 + 62}Q${hw - 4} ${y0 + 86} ${hw - 30} ${y0 + 98}` +
      d`Q${0} ${y0 + 22} ${-hw + 30} ${y0 + 98}Q${-hw + 4} ${y0 + 86} ${-hw + 18} ${y0 + 62}Z`,
  )
  return group(cx, cy, rot, [seat, pad, back])
}

function tableTop(x, y, w, h, salt) {
  return [
    rr(x, y, w, h, 80),
    rr(x + 35, y + 35, w - 70, h - 70, 45, LINE),
    ...(w >= h
      ? grain(x + 60, y + 60, x + w - 60, y + h - 60, 3, salt)
      : grainV(x + 60, y + 60, x + w - 60, y + h - 60, 3, salt)),
  ]
}

function grainV(x0, y0, x1, y1, count, salt) {
  return [group(x0, y1, -90, grain(0, 0, y1 - y0, x1 - x0, count, salt))]
}

function diningSet(w, h, { long, ends }) {
  const off = E + 460 - 150
  const out = []
  const along = (a0, a1, count) =>
    Array.from({ length: count }, (_, i) => a0 + ((a1 - a0) * (i + 0.5)) / count)
  for (const y of along(off + 30, h - off - 30, long)) {
    out.push(chair(E + 230, y, -90))
    out.push(chair(w - E - 230, y, 90))
  }
  for (const x of along(off + 30, w - off - 30, ends)) {
    out.push(chair(x, E + 230, 0))
    out.push(chair(x, h - E - 230, 180))
  }
  out.push(tableTop(off, off, w - 2 * off, h - 2 * off, w + h))
  return out
}

function cushion(x, y, w, h, r) {
  return [soft(x, y, w, h, r, IN), soft(x + 32, y + 30, w - 64, h - 60, r * 0.75, FAINT, 4)]
}

function bolster(x, y, w, h) {
  return [
    soft(x, y, w, h, [w * 0.45, w * 0.45, w * 0.5, w * 0.5], IN, 4),
    line(x + w / 2, y + w * 0.6, x + w / 2, y + h - w * 0.6, FAINT),
  ]
}

function seating(w, h, o) {
  const { seats, aw, bk, bc, r = 90, rBack = r } = o
  const out = [rr(E, E, w - 2 * E, h - 2 * E, [rBack, rBack, r, r])]
  const i = 10
  const backH = Math.max(bk, rBack * 0.95)
  out.push(soft(E + i, E + i, w - 2 * E - 2 * i, backH, [rBack - i, rBack - i, 30, 30], IN, 0))
  const inner0 = E + aw
  const inner1 = w - E - aw
  const cw = (inner1 - inner0) / seats
  const front = h - E - (o.lip ?? 12)
  const sTop = E + bk + bc - 10
  const cr = Math.min(cw, front - sTop) * 0.28
  for (let s = 0; s < seats; s++) {
    const x = inner0 + s * cw
    out.push(cushion(x - 8, sTop, cw + 16, front - sTop, cr))
  }
  for (let s = 0; s < seats; s++) {
    const x = inner0 + s * cw
    out.push(soft(x - 6, E + bk - 25, cw + 12, bc + 30, (bc + 30) * 0.4, IN))
    out.push(
      path(
        d`M${x + 40} ${E + bk + bc / 2}Q${x + cw / 2} ${E + bk + bc / 2 + 18} ${x + cw - 40} ${E + bk + bc / 2}`,
        FAINT,
      ),
    )
  }
  const c = i + aw / 2
  const edge = c < rBack ? rBack - Math.sqrt(rBack * rBack - (rBack - c) ** 2) : 0
  const armTop = E + Math.max(i + bk * 0.45, edge + aw * 0.25)
  out.push(bolster(E + i, armTop, aw - 6, h - E - i - armTop))
  out.push(bolster(w - E - i - aw + 6, armTop, aw - 6, h - E - i - armTop))
  return out
}

for (const [file, w, h, pillows] of [
  ['twin-bed.svg', 991, 1930, 1],
  ['full-bed.svg', 1397, 1930, 2],
  ['queen-bed.svg', 1549, 2057, 2],
  ['king-bed.svg', 1956, 2057, 2],
  ['cal-king-bed.svg', 1854, 2159, 2],
]) {
  symbol(file, w, h, () => bed(w, h, { pillows }))
}

symbol('crib.svg', 711, 1346, (w, h) => {
  const rail = 50
  const out = [rr(E, E, w - 2 * E, h - 2 * E, 60)]
  out.push(rr(E + rail, E + rail, w - 2 * E - 2 * rail, h - 2 * E - 2 * rail, 35, IN))
  for (let y = E + rail + 45; y < h - E - rail - 25; y += 75) {
    out.push(line(E + 14, y, E + rail - 10, y, FAINT))
    out.push(line(w - E - rail + 10, y, w - E - 14, y, FAINT))
  }
  for (let x = E + rail + 45; x < w - E - rail - 25; x += 75) {
    out.push(line(x, E + 14, x, E + rail - 10, FAINT))
    out.push(line(x, h - E - 14, x, h - E - rail + 10, FAINT))
  }
  const bx = E + rail + 22
  out.push(duvet(bx, h * 0.45, w - bx, h - E - rail - 22, { fold: 140, drape: true }))
  return out
})

symbol('sofa-2.svg', 1702, 940, (w, h) => seating(w, h, { seats: 2, aw: 200, bk: 150, bc: 150 }))
symbol('sofa-3.svg', 2388, 965, (w, h) => seating(w, h, { seats: 3, aw: 210, bk: 150, bc: 150 }))
symbol('club-chair.svg', 940, 838, (w, h) =>
  seating(w, h, { seats: 1, aw: 215, bk: 165, bc: 140, r: 120, rBack: 220 }),
)
symbol('lounge-chair-s.svg', 660, 787, (w, h) =>
  seating(w, h, { seats: 1, aw: 95, bk: 110, bc: 140, r: 140, rBack: 300, lip: 30 }),
)

symbol('chair-ottoman.svg', 838, 1448, (w) => {
  const out = seating(w, 900, { seats: 1, aw: 165, bk: 150, bc: 140, r: 130, rBack: 260 })
  const ow = 640
  const ox = (w - ow) / 2
  const oy = 1000
  const oh = 1448 - E - oy
  out.push(soft(ox, oy, ow, oh, 120))
  out.push(soft(ox + 40, oy + 35, ow - 80, oh - 70, 90, FAINT, 4))
  for (const [fx, fy] of [
    [0.33, 0.38],
    [0.67, 0.38],
    [0.5, 0.62],
  ]) {
    out.push(circle(ox + ow * fx, oy + oh * fy, 9, IN))
  }
  return out
})

symbol('lounge-chair.svg', 660, 1753, (w, h) => {
  const out = [rr(E, E, w - 2 * E, h - 2 * E, [250, 250, 160, 160])]
  const x0 = E + 40
  const x1 = w - E - 40
  out.push(cushion(x0, E + 40, x1 - x0, 590, 170))
  out.push(cushion(x0, E + 610, x1 - x0, 560, 120))
  out.push(cushion(x0, E + 1150, x1 - x0, h - 2 * E - 1190, 120))
  out.push(pillow(x0 + 70, E + 80, x1 - x0 - 140, 220))
  return out
})

symbol('sofa-l.svg', 3023, 1829, (w, h) => {
  const notchX = 189
  const notchY = 114
  const armR = 2834
  const chaise = 2085
  const seatFront = 902
  const armL = 230
  const back = 150
  const bc = 165
  const out = [
    rounded(
      [
        [notchX, E],
        [w - E, E],
        [w - E, 1700],
        [armR, 1700],
        [armR, h - E],
        [chaise, h - E],
        [chaise, seatFront],
        [E, seatFront],
        [E, notchY + 6],
        [notchX, notchY + 6],
      ],
      [60, 120, 90, 4, 110, 110, 20, 110, 90, 4],
    ),
  ]
  const i = 10
  out.push(soft(notchX + i, E + i, armR - notchX - i, back - i, [50, 50, 60, 60], IN))
  const sTop = E + back + bc - 10
  const half = (chaise - armL - E) / 2
  out.push(cushion(chaise - 8, sTop, armR - chaise + 2, h - E - 12 - sTop, 190))
  for (let s = 0; s < 2; s++) {
    const x = E + armL + s * half
    out.push(cushion(x - 8, sTop, half + 16, seatFront - 12 - sTop, 160))
  }
  for (const [x0, x1] of [
    [E + armL, E + armL + half],
    [E + armL + half, chaise],
    [chaise, armR],
  ]) {
    out.push(soft(x0 - 6, E + back - 25, x1 - x0 + 12, bc + 30, 78, IN))
    out.push(
      path(
        d`M${x0 + 40} ${E + back + bc / 2}Q${(x0 + x1) / 2} ${E + back + bc / 2 + 18} ${x1 - 40} ${E + back + bc / 2}`,
        FAINT,
      ),
    )
  }
  out.push(bolster(E + i, notchY + 6 + i, armL - 16, seatFront - notchY - 6 - 2 * i))
  out.push(
    bolster(armR + 6, E + i + back * 0.45, w - E - i - armR - 6, 1700 - i - E - i - back * 0.45),
  )
  return out
})

symbol('dining-chair.svg', 440, 460, (w, h) => [
  chair(w / 2, h / 2, 0, w - 2 * E + 25, h - 2 * E + 25),
])
symbol('dining-6.svg', 1600, 2210, (w, h) => diningSet(w, h, { long: 2, ends: 1 }))
symbol('dining-8.svg', 1600, 2362, (w, h) => diningSet(w, h, { long: 3, ends: 1 }))
symbol('dining-square-4.svg', 1600, 1600, (w, h) => diningSet(w, h, { long: 1, ends: 1 }))
symbol('dining-square-8.svg', 2489, 2362, (w, h) => diningSet(w, h, { long: 2, ends: 2 }))

function roundTop(c, r) {
  const out = [circle(c, c, r), circle(c, c, r - 35, LINE)]
  for (const [dy, salt] of [
    [-0.35, 3],
    [0, 5],
    [0.35, 7],
  ]) {
    const y = c + dy * r
    const half = Math.sqrt(r * r - (dy * r) ** 2) - 90
    out.push(grain(c - half, y - 20, c + half, y + 20, 1, salt))
  }
  return out
}

symbol('dining-round-4.svg', 1600, 1600, (w, h) => [
  chair(w / 2, E + 230, 0),
  chair(w / 2, h - E - 230, 180),
  chair(E + 230, h / 2, -90),
  chair(w - E - 230, h / 2, 90),
  roundTop(w / 2, w / 2 - (E + 460 - 160)),
])

symbol('table-rectangular.svg', 1800, 900, (w, h) => [
  rr(E, E, w - 2 * E, h - 2 * E, 60),
  rr(E + 35, E + 35, w - 2 * E - 70, h - 2 * E - 70, 40, LINE),
  ...grain(E + 70, E + 70, w - E - 70, h - E - 70, 4, 11),
])

symbol('coffee-table.svg', 914, 914, (w) => roundTop(w / 2, w / 2 - E))

symbol('side-table.svg', 584, 584, (w, h) => [
  rr(E, E, w - 2 * E, h - 2 * E, 80),
  rr(E + 35, E + 35, w - 2 * E - 70, h - 2 * E - 70, 55, LINE),
  ...grain(E + 70, E + 70, w - E - 70, h - E - 70, 2, 13),
])

symbol('bench.svg', 2032, 406, (w, h) => {
  const out = [rr(E, E, w - 2 * E, h - 2 * E, 50)]
  const slats = 4
  const step = (h - 2 * E - 30) / slats
  for (let s = 0; s < slats; s++) {
    const y = E + 15 + s * step
    out.push(rr(E + 15, y + 4, w - 2 * E - 30, step - 8, 30, IN))
    out.push(grain(E + 60, y + 15, w - E - 60, y + step - 15, 1, 20 + s))
  }
  return out
})

symbol('office-chair.svg', 711, 660, (w, h) => {
  const cx = w / 2
  const cy = h / 2 + 15
  const legR = Math.min(w / 2, h / 2) - E - 30
  const out = []
  for (let k = 0; k < 5; k++) {
    const a = ((-90 + 36 + k * 72) * Math.PI) / 180
    const ex = cx + Math.cos(a) * legR
    const ey = cy + Math.sin(a) * legR
    const nx = -Math.sin(a) * 14
    const ny = Math.cos(a) * 14
    out.push(
      path(
        d`M${cx + nx * 2} ${cy + ny * 2}L${ex + nx} ${ey + ny}L${ex - nx} ${ey - ny}L${cx - nx * 2} ${cy - ny * 2}Z`,
        {
          fill: LIGHT,
          sw: 0.5,
        },
      ),
    )
    out.push(circle(ex, ey, 24, IN))
  }
  out.push(soft(cx - 230, cy - 195, 460, 420, [110, 110, 170, 170]))
  out.push(soft(cx - 190, cy - 140, 380, 330, [80, 80, 140, 140], FAINT, 4))
  out.push(path(d`M${cx - 200} ${cy + 175}Q${cx} ${cy + 205} ${cx + 200} ${cy + 175}`, FAINT))
  out.push(rr(cx - 290, cy - 110, 56, 290, 28, IN))
  out.push(rr(cx + 234, cy - 110, 56, 290, 28, IN))
  out.push(
    path(
      d`M${cx - 255} ${cy - 145}Q${cx} ${E - 55} ${cx + 255} ${cy - 145}Q${cx + 262} ${cy - 112} ${cx + 228} ${cy - 108}` +
        d`Q${cx} ${E + 20} ${cx - 228} ${cy - 108}Q${cx - 262} ${cy - 112} ${cx - 255} ${cy - 145}Z`,
    ),
  )
  return out
})

function cabinet(w, h, { pulls, salt = 1 }) {
  const front = h - E - 26
  const out = [
    rr(E, E, w - 2 * E, front - E, [35, 35, 60, 60]),
    rr(E + 28, E + 28, w - 2 * E - 56, front - E - 56, 30, LINE),
    ...grain(
      E + 60,
      E + 60,
      w - E - 60,
      front - 60,
      Math.max(2, Math.min(4, Math.round((front - E) / 150))),
      salt,
    ),
  ]
  for (const x of pulls) out.push(rr(x - 55, front - 12, 110, 38, 19, { fill: LIGHT, sw: 0.5 }))
  return out
}

function lampTop(cx, cy, r) {
  const out = [circle(cx, cy, r), circle(cx, cy, r * 0.45, LINE)]
  for (let k = 0; k < 24; k++) {
    const a = (k * 15 * Math.PI) / 180
    out.push(
      line(
        cx + Math.cos(a) * r * 0.5,
        cy + Math.sin(a) * r * 0.5,
        cx + Math.cos(a) * r * 0.93,
        cy + Math.sin(a) * r * 0.93,
        FAINT,
      ),
    )
  }
  out.push(circle(cx, cy, Math.max(14, r * 0.12), { fill: LIGHT, sw: 0.5 }))
  return out
}

symbol('dresser.svg', 1295, 787, (w, h) => cabinet(w, h, { pulls: [w * 0.27, w * 0.73], salt: 31 }))
symbol('credenza.svg', 1549, 559, (w, h) =>
  cabinet(w, h, { pulls: [w * 0.25 - 70, w * 0.25 + 70, w * 0.75 - 70, w * 0.75 + 70], salt: 37 }),
)
symbol('nightstand.svg', 635, 533, (w, h) => {
  const out = cabinet(w, h, { pulls: [w / 2], salt: 41 })
  out.push(lampTop(E + 170, E + 170, 125))
  out.push(rr(w - E - 245, h - E - 255, 190, 140, 12, IN))
  out.push(line(w - E - 235, h - E - 128, w - E - 65, h - E - 128, FAINT))
  return out
})
symbol('filing-cabinet.svg', 457, 533, (w, h) => cabinet(w, h, { pulls: [w / 2], salt: 43 }))

symbol('bookshelf.svg', 940, 330, (w, h) => [
  rr(E, E, w - 2 * E, h - 2 * E, [15, 15, 40, 40]),
  rr(E + 25, E + 25, w - 2 * E - 50, h - 2 * E - 50, 25, LINE),
  ...grain(E + 50, E + 50, w - E - 50, h - E - 50, 2, 47),
])

symbol('built-in-shelf.svg', 940, 381, (w, h) => {
  const t = 25
  const out = [rr(E, E, w - 2 * E, h - 2 * E, [10, 10, 30, 30])]
  out.push(rrBox(E + t, E + t, w - E - t, h - E - 6, [8, 8, 20, 20], { fill: LIGHT, sw: 0.5 }))
  let x = E + t + 20
  const books = [40, 30, 55, 35, 45, 30, 60, 38, 42, 30, 50, 34, 46]
  for (const bw of books) {
    if (x + bw > w * 0.55) break
    const depth = 200 + ((bw * 7) % 60)
    out.push(rr(x, E + t + 10, bw, depth, 6, IN))
    x += bw + 3
  }
  out.push(rr(w * 0.62, E + t + 40, 220, 160, 14, IN))
  out.push(rr(w * 0.62 + 15, E + t + 15, 190, 160, 14, IN))
  out.push(circle(w * 0.88, E + t + 130, 55, IN))
  out.push(circle(w * 0.88, E + t + 130, 30, FAINT))
  return out
})

symbol('media-unit.svg', 1626, 356, (w, h) => {
  const out = cabinet(w, h, { pulls: [w * 0.2, w * 0.8], salt: 53 })
  const tw = 1240
  out.push(rr(w / 2 - 170, E + 45, 340, 170, 40, { fill: LIGHT, sw: 0.5 }))
  out.push(rr((w - tw) / 2, E + 78, tw, 36, 14, { fill: INK, sw: 0.5 }))
  return out
})

symbol('television-flat.svg', 1120, 225, (w, h) => {
  const out = []
  for (const x of [w * 0.22, w * 0.78])
    out.push(rr(x - 28, E + 4, 56, h - 2 * E - 8, 28, { fill: LIGHT, sw: 0.5 }))
  out.push(rr(E, E + 48, w - 2 * E, 40, 16, { fill: INK, sw: 0.5 }))
  return out
})

symbol('console-mirror.svg', 1143, 483, (w, h) => [
  rr(E, E + 20, w - 2 * E, h - 2 * E - 20, [25, 25, 50, 50]),
  rr(E + 32, E + 65, w - 2 * E - 64, h - 2 * E - 97, 30, LINE),
  ...grain(E + 70, E + 100, w - E - 70, h - E - 60, 3, 59),
  rr(E + 110, E, w - 2 * E - 220, 36, 14, { fill: LIGHT, sw: 0.5 }),
  line(E + 150, E + 18, w - E - 150, E + 18, FAINT),
])

symbol('clothing-rack.svg', 1321, 508, (w, h) => {
  const out = []
  const feet = 50
  const rx0 = E + feet / 2
  const rx1 = w - E - feet / 2
  const ry = h / 2
  for (let x = rx0 + 80, k = 0; x < rx1 - 60; x += 72, k++) {
    const half = 170 + (k % 3) * 18
    out.push(soft(x - 26, ry - half, 52, 2 * half, 26, IN, 3))
  }
  out.push(rr(rx0, ry - 14, rx1 - rx0, 28, 14, { fill: LIGHT, sw: 0.5 }))
  out.push(rr(E, E, feet, h - 2 * E, 25))
  out.push(rr(w - E - feet, E, feet, h - 2 * E, 25))
  return out
})

symbol('coat-stand.svg', 432, 432, (w) => {
  const c = w / 2
  const out = [circle(c, c, c - E, HIDDEN)]
  for (let k = 0; k < 6; k++) {
    const a = (k * 60 * Math.PI) / 180
    const r = c - E - 35
    const mx = c + Math.cos(a + 0.25) * r * 0.55
    const my = c + Math.sin(a + 0.25) * r * 0.55
    out.push(
      path(d`M${c} ${c}Q${mx} ${my} ${c + Math.cos(a) * r} ${c + Math.sin(a) * r}`, {
        fill: 'none',
        sw: 1,
      }),
    )
    out.push(circle(c + Math.cos(a) * r, c + Math.sin(a) * r, 18))
  }
  out.push(circle(c, c, 32))
  return out
})

symbol('floor-lamp.svg', 533, 533, (w) => lampTop(w / 2, w / 2, w / 2 - E))
symbol('table-lamp.svg', 356, 356, (w) => lampTop(w / 2, w / 2, w / 2 - E))

symbol('picture-frame.svg', 330, 51, (w, h) => [
  rr(E, E, w - 2 * E, h - 2 * E, 6, IN),
  rr(E + 25, E + 7, w - 2 * E - 50, h - 2 * E - 14, 3, { fill: LIGHT, sw: 0.3 }),
])

symbol('rug-rect.svg', 2438, 1829, (w, h) => {
  const fringe = 80
  const out = []
  for (let y = E + 50; y < h - E - 40; y += 40) {
    const wob = (seed(y) - 0.5) * 12
    out.push(
      path(d`M${E + 6} ${y + wob}Q${E + fringe / 2} ${y - wob} ${E + fringe + 10} ${y}`, LINE),
    )
    out.push(
      path(
        d`M${w - E - fringe - 10} ${y}Q${w - E - fringe / 2} ${y + wob} ${w - E - 6} ${y - wob}`,
        LINE,
      ),
    )
  }
  const x0 = E + fringe
  const x1 = w - E - fringe
  out.push(rrBox(x0, E, x1, h - E, 60))
  out.push(rrBox(x0 + 100, E + 100, x1 - 100, h - E - 100, 40, LINE))
  out.push(rrBox(x0 + 170, E + 170, x1 - 170, h - E - 170, 30, LINE))
  const cx = w / 2
  const cy = h / 2
  out.push(
    rounded(
      [
        [cx, cy - 330],
        [cx + 480, cy],
        [cx, cy + 330],
        [cx - 480, cy],
      ],
      60,
      LINE,
    ),
  )
  out.push(
    rounded(
      [
        [cx, cy - 170],
        [cx + 250, cy],
        [cx, cy + 170],
        [cx - 250, cy],
      ],
      30,
      LINE,
    ),
  )
  return out
})

symbol('rug-round.svg', 2438, 2438, (w) => {
  const c = w / 2
  const R = c - E
  const body = R - 75
  const out = []
  for (let k = 0; k < 120; k++) {
    const a = (k * 3 * Math.PI) / 180
    const b = a + (seed(k) - 0.5) * 0.02
    out.push(
      line(
        c + Math.cos(a) * (body - 10),
        c + Math.sin(a) * (body - 10),
        c + Math.cos(b) * R,
        c + Math.sin(b) * R,
      ),
    )
  }
  out.push(circle(c, c, body))
  out.push(circle(c, c, body - 100, LINE))
  out.push(circle(c, c, body - 170, LINE))
  out.push(circle(c, c, 300, LINE))
  out.push(circle(c, c, 150, LINE))
  return out
})

function workstation(cx, top) {
  return [
    rr(cx - 120, top + 70, 240, 160, 60, { fill: LIGHT, sw: 0.5 }),
    rr(cx - 300, top + 118, 600, 32, 14, { fill: INK, sw: 0.5 }),
    rr(cx - 225, top + 330, 450, 140, 35, IN),
    line(cx - 190, top + 380, cx + 190, top + 380, FAINT),
    line(cx - 190, top + 420, cx + 190, top + 420, FAINT),
    ellipse(cx + 330, top + 400, 36, 56, IN),
    line(cx + 330, top + 350, cx + 330, top + 385, FAINT),
  ]
}

symbol('office-desk.svg', 1829, 813, (w, h) => [
  rr(E, E, w - 2 * E, h - 2 * E, [40, 40, 70, 70]),
  rr(E + 30, E + 30, w - 2 * E - 60, h - 2 * E - 60, 45, LINE),
  ...grain(E + 70, E + 520, w - E - 70, h - E - 50, 2, 61),
  rrBox(w - E - 440, E + 45, w - E - 45, h - E - 45, 30, HIDDEN),
  ...workstation(w * 0.42, E),
])

symbol('office-desk-l.svg', 1600, 1100, (w, h) => {
  const main = 605 - 8
  const leg = 600 - 8
  const corners = [
    [E, E],
    [w - E, E],
    [w - E, main],
    [leg, main],
    [leg, h - E],
    [E, h - E],
  ]
  const inset = [
    [E + 30, E + 30],
    [w - E - 30, E + 30],
    [w - E - 30, main - 30],
    [leg - 30, main - 30],
    [leg - 30, h - E - 30],
    [E + 30, h - E - 30],
  ]
  return [
    rounded(corners, [300, 40, 70, 28, 70, 70]),
    rounded(inset, [270, 20, 45, 1, 45, 45], LINE),
    ...grainV(E + 70, main + 20, leg - 70, h - E - 70, 2, 67),
    rrBox(E + 45, h - E - 470, leg - 45, h - E - 45, 30, HIDDEN),
    ...workstation(w * 0.58, E),
  ]
})

write()
