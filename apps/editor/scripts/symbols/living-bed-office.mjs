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

const n = (mm) => String(+(mm / MM).toFixed(2))
const d = (strings, ...values) =>
  strings.reduce((out, s, i) => out + s + (i < values.length ? n(values[i]) : ''), '')

function style({ fill = WHITE, sw = 1, dash, stroke = INK } = {}) {
  let s = `fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"`
  if (dash) s += ` stroke-dasharray="${dash}"`
  return s
}
const DETAIL = { sw: 0.5 }
const LINE = { fill: 'none', sw: 0.5 }
const HIDDEN = { fill: 'none', sw: 0.5, dash: '2 1.5' }

function rect(x, y, w, h, o = {}) {
  const r = o.r ? ` rx="${n(Math.min(o.r, w / 2, h / 2))}"` : ''
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${r} ${style(o)}/>`
}
const box = (x0, y0, x1, y1, o) => rect(x0, y0, x1 - x0, y1 - y0, o)
const circle = (cx, cy, r, o = {}) =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" ${style(o)}/>`
const ellipse = (cx, cy, rx, ry, o = {}) =>
  `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" ${style(o)}/>`
const line = (x1, y1, x2, y2, o = LINE) =>
  `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" ${style({ ...LINE, ...o, fill: 'none' })}/>`
const path = (p, o = {}) => `<path d="${p}" ${style(o)}/>`
const polygon = (points, o = {}) =>
  `<polygon points="${points.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}" ${style(o)}/>`
const group = (tx, ty, rot, body) =>
  `<g transform="translate(${n(tx)} ${n(ty)})${rot ? ` rotate(${rot})` : ''}">${body.join('')}</g>`

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

function bed(w, h, { pillows }) {
  const head = 75
  const mx = E + 35
  const my = E + head
  const mw = w - 2 * mx
  const mb = h - E - 30
  const out = [
    rect(E, E, w - 2 * E, h - 2 * E, { r: 30 }),
    rect(mx, my, mw, mb - my, { r: 45, sw: 0.5 }),
    rect(E, E, w - 2 * E, head, { r: 25 }),
    line(E + 40, E + head / 2, w - E - 40, E + head / 2),
  ]
  const pd = 430
  const pw = Math.min(720, (mw - (pillows + 1) * 55) / pillows)
  const gap = (mw - pillows * pw) / (pillows + 1)
  const py = my + 55
  for (let i = 0; i < pillows; i++) {
    const x = mx + gap + i * (pw + gap)
    out.push(rect(x, py, pw, pd, { r: 110, sw: 0.5 }))
    out.push(rect(x + 45, py + 45, pw - 90, pd - 90, { r: 80, ...LINE }))
  }
  const top = py + pd + 130
  const dx = mx - 18
  const dw = mw + 36
  const fold = 280
  const corner = Math.min(380, dw * 0.3)
  out.push(
    polygon(
      [
        [dx, top],
        [dx + dw - corner, top],
        [dx + dw, top + corner],
        [dx + dw, mb + 12],
        [dx, mb + 12],
      ],
      { sw: 0.5 },
    ),
  )
  out.push(line(dx, top + fold, dx + dw - corner, top + fold, { sw: 0.5 }))
  out.push(
    polygon(
      [
        [dx + dw - corner, top],
        [dx + dw, top + corner],
        [dx + dw - corner, top + corner],
      ],
      { fill: LIGHT, sw: 0.5 },
    ),
  )
  return out
}

function chair(cx, cy, rot, w = 440, h = 460) {
  const x0 = -w / 2
  const y0 = -h / 2
  const seat = path(
    d`M${x0 + 25} ${y0 + 45} L${x0 + w - 25} ${y0 + 45} L${x0 + w - 35} ${y0 + h - 70} Q${x0 + w - 40} ${
      y0 + h - 15
    } ${x0 + w - 90} ${y0 + h - 15} L${x0 + 90} ${y0 + h - 15} Q${x0 + 40} ${y0 + h - 15} ${x0 + 35} ${y0 + h - 70} Z`,
  )
  const back = path(
    d`M${x0 + 10} ${y0 + 35} Q${0} ${y0 - 25} ${x0 + w - 10} ${y0 + 35} L${x0 + w - 10} ${y0 + 85} Q${0} ${
      y0 + 25
    } ${x0 + 10} ${y0 + 85} Z`,
  )
  const pad = rect(x0 + 75, y0 + 105, w - 150, h - 160, { r: 60, ...LINE })
  return group(cx, cy, rot, [seat, pad, back])
}

function table(x, y, w, h) {
  return [rect(x, y, w, h, { r: 25 }), rect(x + 40, y + 40, w - 80, h - 80, { r: 15, ...LINE })]
}

function diningSet(w, h, { long, ends }) {
  const off = E + 460 - 150
  const tx0 = off
  const ty0 = off
  const tx1 = w - off
  const ty1 = h - off
  const cx = w / 2
  const cy = h / 2
  const out = []
  const along = (a0, a1, count) => {
    const span = a1 - a0
    return Array.from({ length: count }, (_, i) => a0 + (span * (i + 0.5)) / count)
  }
  for (const y of along(ty0 + 30, ty1 - 30, long)) {
    out.push(chair(E + 230, y, -90))
    out.push(chair(w - E - 230, y, 90))
  }
  for (const x of along(tx0 + 30, tx1 - 30, ends)) {
    out.push(chair(x, E + 230, 0))
    out.push(chair(x, h - E - 230, 180))
  }
  out.push(table(tx0, ty0, tx1 - tx0, ty1 - ty0))
  void cx
  void cy
  return out
}

function seating(w, h, o) {
  const { seats, aw, bk, bc, r = 60, rBack = r } = o
  const out = []
  const inner0 = E + aw
  const inner1 = w - E - aw
  out.push(
    path(
      d`M${E} ${E + rBack} Q${E} ${E} ${E + rBack} ${E} L${w - E - rBack} ${E} Q${w - E} ${E} ${w - E} ${
        E + rBack
      } L${w - E} ${h - E - r} Q${w - E} ${h - E} ${w - E - r} ${h - E} L${E + r} ${h - E} Q${E} ${h - E} ${E} ${
        h - E - r
      } Z`,
    ),
  )
  const cw = (inner1 - inner0) / seats
  const front = h - E - (o.lip ?? 10)
  for (let i = 0; i < seats; i++) {
    const x = inner0 + i * cw
    out.push(rect(x + 4, E + bk + bc, cw - 8, front - (E + bk + bc), { r: 55, sw: 0.5 }))
    out.push(rect(x + 4, E + bk, cw - 8, bc + 30, { r: 45, sw: 0.5 }))
  }
  out.push(rect(E, E + Math.max(bk - 40, 0), aw, h - 2 * E - Math.max(bk - 40, 0), { r: aw / 2.4 }))
  out.push(
    rect(w - E - aw, E + Math.max(bk - 40, 0), aw, h - 2 * E - Math.max(bk - 40, 0), {
      r: aw / 2.4,
    }),
  )
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
  const rail = 55
  const out = [rect(E, E, w - 2 * E, h - 2 * E, { r: 25 })]
  out.push(rect(E + rail, E + rail, w - 2 * E - 2 * rail, h - 2 * E - 2 * rail, { sw: 0.5 }))
  for (let y = E + rail + 60; y < h - E - rail - 30; y += 80) {
    out.push(line(E + 12, y, E + rail - 12, y))
    out.push(line(w - E - rail + 12, y, w - E - 12, y))
  }
  const bx = E + rail + 25
  const bw = w - 2 * bx
  const top = h * 0.48
  out.push(rect(bx, top, bw, h - E - rail - 25 - top, { r: 30, sw: 0.5 }))
  out.push(line(bx, top + 150, bx + bw, top + 150))
  out.push(
    polygon(
      [
        [bx + bw - 180, top],
        [bx + bw, top + 180],
        [bx + bw - 180, top + 180],
      ],
      { fill: LIGHT, sw: 0.5 },
    ),
  )
  return out
})

symbol('sofa-2.svg', 1702, 940, (w, h) => seating(w, h, { seats: 2, aw: 190, bk: 150, bc: 150 }))
symbol('sofa-3.svg', 2388, 965, (w, h) => seating(w, h, { seats: 3, aw: 200, bk: 150, bc: 150 }))
symbol('club-chair.svg', 940, 838, (w, h) =>
  seating(w, h, { seats: 1, aw: 200, bk: 170, bc: 140, r: 90, rBack: 140 }),
)
symbol('lounge-chair-s.svg', 660, 787, (w, h) =>
  seating(w, h, { seats: 1, aw: 85, bk: 110, bc: 150, r: 110, rBack: 240, lip: 30 }),
)

symbol('chair-ottoman.svg', 838, 1448, (w) => {
  const chairH = 900
  const out = seating(w, chairH, { seats: 1, aw: 150, bk: 150, bc: 140, r: 100, rBack: 220 })
  const ow = 620
  out.push(rect((w - ow) / 2, 1005, ow, 1448 - E - 1005, { r: 70 }))
  out.push(rect((w - ow) / 2 + 45, 1050, ow - 90, 1448 - E - 1095, { r: 45, ...LINE }))
  return out
})

symbol('lounge-chair.svg', 660, 1753, (w, h) => {
  const out = [rect(E, E, w - 2 * E, h - 2 * E, { r: 140 })]
  const x0 = E + 45
  const x1 = w - E - 45
  out.push(rect(x0, E + 45, x1 - x0, 560, { r: 110, sw: 0.5 }))
  out.push(rect(x0, E + 625, x1 - x0, 540, { r: 60, sw: 0.5 }))
  out.push(rect(x0, E + 1185, x1 - x0, h - 2 * E - 1230, { r: 60, sw: 0.5 }))
  out.push(rect(x0 + 90, E + 80, x1 - x0 - 180, 200, { r: 90, sw: 0.5 }))
  for (const y of [E + 360, E + 460]) out.push(line(x0 + 40, y, x1 - 40, y))
  return out
})

symbol('sofa-l.svg', 3023, 1829, (w, h) => {
  const notchX = 189
  const notchY = 114
  const armL = 225
  const armR = 2834
  const chaise = 2085
  const back = 150
  const bc = 165
  const seatFront = 902
  const out = [box(notchX, E, w - E, E + back, { r: 25 })]
  const sTop = E + back + bc
  const half = (chaise - armL - E) / 2
  for (let i = 0; i < 2; i++) {
    const x = E + armL + i * half
    out.push(rect(x + 4, sTop, half - 8, seatFront - sTop, { r: 55, sw: 0.5 }))
    out.push(rect(x + 4, E + back, half - 8, bc + 30, { r: 45, sw: 0.5 }))
  }
  out.push(rect(chaise + 4, sTop, armR - chaise - 8, h - E - sTop, { r: 60, sw: 0.5 }))
  out.push(line(chaise + 50, seatFront, armR - 50, seatFront))
  out.push(rect(chaise + 4, E + back, armR - chaise - 8, bc + 30, { r: 45, sw: 0.5 }))
  out.push(box(E, notchY + 6, E + armL, seatFront, { r: 90 }))
  out.push(box(armR, E, w - E, 1700, { r: 80 }))
  return out
})

symbol('dining-chair.svg', 440, 460, (w, h) => [
  chair(w / 2, h / 2, 0, w - 2 * E + 25, h - 2 * E + 25),
])
symbol('dining-6.svg', 1600, 2210, (w, h) => diningSet(w, h, { long: 2, ends: 1 }))
symbol('dining-8.svg', 1600, 2362, (w, h) => diningSet(w, h, { long: 3, ends: 1 }))
symbol('dining-square-4.svg', 1600, 1600, (w, h) => diningSet(w, h, { long: 1, ends: 1 }))
symbol('dining-square-8.svg', 2489, 2362, (w, h) => diningSet(w, h, { long: 2, ends: 2 }))
symbol('dining-round-4.svg', 1600, 1600, (w, h) => {
  const r = w / 2 - (E + 460 - 160)
  return [
    chair(w / 2, E + 230, 0),
    chair(w / 2, h - E - 230, 180),
    chair(E + 230, h / 2, -90),
    chair(w - E - 230, h / 2, 90),
    circle(w / 2, h / 2, r),
    circle(w / 2, h / 2, r - 40, LINE),
  ]
})

symbol('table-rectangular.svg', 1800, 900, (w, h) => {
  const out = [rect(E, E, w - 2 * E, h - 2 * E, { r: 15 })]
  for (const y of [h * 0.3, h * 0.5, h * 0.7]) out.push(line(E + 20, y, w - E - 20, y, { sw: 0.5 }))
  out.push(box(E + 90, E + 50, E + 130, h - E - 50, HIDDEN))
  out.push(box(w - E - 130, E + 50, w - E - 90, h - E - 50, HIDDEN))
  return out
})

symbol('coffee-table.svg', 914, 914, (w, h) => [
  circle(w / 2, h / 2, w / 2 - E),
  circle(w / 2, h / 2, w / 2 - E - 45, LINE),
  circle(w / 2, h / 2, w * 0.18, HIDDEN),
])

symbol('side-table.svg', 584, 584, (w, h) => [
  rect(E, E, w - 2 * E, h - 2 * E, { r: 40 }),
  rect(E + 45, E + 45, w - 2 * E - 90, h - 2 * E - 90, { r: 20, ...LINE }),
])

symbol('bench.svg', 2032, 406, (w, h) => {
  const out = [rect(E, E, w - 2 * E, h - 2 * E, { r: 20 })]
  const slats = 4
  const step = (h - 2 * E) / slats
  for (let i = 1; i < slats; i++) out.push(line(E + 10, E + i * step, w - E - 10, E + i * step))
  out.push(box(E + 60, E, E + 110, h - E, HIDDEN))
  out.push(box(w - E - 110, E, w - E - 60, h - E, HIDDEN))
  return out
})

symbol('office-chair.svg', 711, 660, (w, h) => {
  const cx = w / 2
  const cy = h / 2 + 15
  const legR = Math.min(w / 2, h / 2) - E - 32
  const out = []
  for (let i = 0; i < 5; i++) {
    const a = ((-90 + 36 + i * 72) * Math.PI) / 180
    const ex = cx + Math.cos(a) * legR
    const ey = cy + Math.sin(a) * legR
    out.push(line(cx, cy, ex, ey, { sw: 1 }))
    out.push(circle(ex, ey, 26, { fill: GREY, sw: 0.5 }))
  }
  out.push(rect(cx - 225, cy - 205, 450, 430, { r: 120 }))
  out.push(rect(cx - 285, cy - 110, 50, 290, { r: 25, fill: GREY, sw: 0.5 }))
  out.push(rect(cx + 235, cy - 110, 50, 290, { r: 25, fill: GREY, sw: 0.5 }))
  out.push(
    path(
      d`M${cx - 250} ${cy - 150} Q${cx} ${E - 40} ${cx + 250} ${cy - 150} L${cx + 225} ${cy - 105} Q${cx} ${
        E + 35
      } ${cx - 225} ${cy - 105} Z`,
    ),
  )
  return out
})

function cabinet(w, h, { pulls, reveal = 35 }) {
  const front = h - E - 28
  const out = [
    rect(E, E, w - 2 * E, front - E, { r: 10 }),
    box(E + reveal, E + reveal, w - E - reveal, front - reveal, LINE),
  ]
  for (const x of pulls) out.push(rect(x - 60, front - 5, 120, 28, { r: 10, fill: GREY, sw: 0.5 }))
  return out
}

symbol('dresser.svg', 1295, 787, (w, h) => cabinet(w, h, { pulls: [w * 0.27, w * 0.73] }))
symbol('credenza.svg', 1549, 559, (w, h) => [
  ...cabinet(w, h, {
    pulls: [w * 0.25 - 70, w * 0.25 + 70, w * 0.75 - 70, w * 0.75 + 70].map((x) => x),
  }),
])
symbol('nightstand.svg', 635, 533, (w, h) => cabinet(w, h, { pulls: [w / 2] }))
symbol('filing-cabinet.svg', 457, 533, (w, h) => cabinet(w, h, { pulls: [w / 2], reveal: 25 }))

symbol('bookshelf.svg', 940, 330, (w, h) => [
  rect(E, E, w - 2 * E, h - 2 * E),
  line(E + 20, E + 35, w - E - 20, E + 35),
  box(w / 2 - 10, E + 35, w / 2 + 10, h - E, HIDDEN),
])

symbol('built-in-shelf.svg', 940, 381, (w, h) => {
  const t = 25
  const out = [rect(E, E, w - 2 * E, h - 2 * E)]
  out.push(box(E + t, E + t, w - E - t, h - E, { sw: 0.5, fill: LIGHT }))
  let x = E + t + 20
  const books = [40, 30, 55, 35, 45, 30, 60, 38, 42, 30, 50, 34, 46]
  for (const bw of books) {
    if (x + bw > w * 0.55) break
    const depth = 200 + ((bw * 7) % 60)
    out.push(rect(x, E + t + 10, bw, depth, { sw: 0.5 }))
    x += bw + 3
  }
  out.push(rect(w * 0.62, E + t + 30, 220, 160, { sw: 0.5, r: 8 }))
  out.push(rect(w * 0.62 + 15, E + t + 15, 190, 160, { sw: 0.5, r: 8 }))
  return out
})

symbol('media-unit.svg', 1626, 356, (w, h) => {
  const out = cabinet(w, h, { pulls: [w * 0.2, w * 0.8], reveal: 25 })
  const tw = 1240
  out.push(rect(w / 2 - 170, E + 45, 340, 170, { r: 20, fill: GREY, sw: 0.5 }))
  out.push(rect((w - tw) / 2, E + 75, tw, 40, { r: 8, fill: INK, sw: 0.5 }))
  return out
})

symbol('television-flat.svg', 1120, 225, (w, h) => {
  const out = []
  for (const x of [w * 0.22, w * 0.78])
    out.push(rect(x - 25, E + 5, 50, h - 2 * E - 10, { r: 20, fill: GREY, sw: 0.5 }))
  out.push(rect(E, E + 45, w - 2 * E, 45, { r: 10, fill: INK, sw: 0.5 }))
  return out
})

symbol('console-mirror.svg', 1143, 483, (w, h) => [
  rect(E, E + 20, w - 2 * E, h - 2 * E - 20, { r: 15 }),
  box(E + 40, E + 80, w - E - 40, h - E - 40, LINE),
  rect(E + 110, E, w - 2 * E - 220, 35, { fill: LIGHT, sw: 0.5, r: 5 }),
  line(E + 140, E + 17, w - E - 140, E + 17),
])

symbol('clothing-rack.svg', 1321, 508, (w, h) => {
  const out = []
  const feet = 45
  const rx0 = E + feet / 2
  const rx1 = w - E - feet / 2
  const ry = h / 2
  for (let x = rx0 + 80, i = 0; x < rx1 - 60; x += 72, i++) {
    const half = 175 + (i % 3) * 15
    out.push(ellipse(x, ry, 26, half, { sw: 0.5 }))
  }
  out.push(rect(rx0, ry - 14, rx1 - rx0, 28, { r: 14, fill: GREY, sw: 0.5 }))
  out.push(rect(E, E, feet, h - 2 * E, { r: 20 }))
  out.push(rect(w - E - feet, E, feet, h - 2 * E, { r: 20 }))
  return out
})

symbol('coat-stand.svg', 432, 432, (w, h) => {
  const c = w / 2
  const out = [circle(c, c, c - E, HIDDEN)]
  for (let i = 0; i < 6; i++) {
    const a = (i * 60 * Math.PI) / 180
    const r = c - E - 35
    out.push(line(c, c, c + Math.cos(a) * r, c + Math.sin(a) * r, { sw: 1 }))
    out.push(circle(c + Math.cos(a) * r, c + Math.sin(a) * r, 18))
  }
  out.push(circle(c, c, 30))
  return out
})

symbol('floor-lamp.svg', 533, 533, (w) => {
  const c = w / 2
  return [
    circle(c, c, c - E),
    circle(c, c, (c - E) * 0.62, LINE),
    circle(c, c, 30, { fill: GREY, sw: 0.5 }),
  ]
})

symbol('table-lamp.svg', 356, 356, (w) => {
  const c = w / 2
  return [
    circle(c, c, c - E),
    circle(c, c, (c - E) * 0.55, LINE),
    circle(c, c, 22, { fill: GREY, sw: 0.5 }),
  ]
})

symbol('picture-frame.svg', 330, 51, (w, h) => [
  rect(E, E, w - 2 * E, h - 2 * E, { sw: 0.5 }),
  rect(E + 25, E + 6, w - 2 * E - 50, h - 2 * E - 12, { fill: LIGHT, sw: 0.5 }),
])

symbol('rug-rect.svg', 2438, 1829, (w, h) => {
  const fringe = 80
  const out = []
  for (let y = E + 30; y < h - E - 20; y += 40) {
    out.push(line(E, y, E + fringe, y))
    out.push(line(w - E - fringe, y, w - E, y))
  }
  const x0 = E + fringe
  const x1 = w - E - fringe
  out.push(box(x0, E, x1, h - E))
  out.push(box(x0 + 110, E + 110, x1 - 110, h - E - 110, LINE))
  out.push(box(x0 + 190, E + 190, x1 - 190, h - E - 190, LINE))
  const cx = w / 2
  const cy = h / 2
  out.push(
    polygon(
      [
        [cx, cy - 330],
        [cx + 480, cy],
        [cx, cy + 330],
        [cx - 480, cy],
      ],
      LINE,
    ),
  )
  out.push(
    polygon(
      [
        [cx, cy - 170],
        [cx + 250, cy],
        [cx, cy + 170],
        [cx - 250, cy],
      ],
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
  for (let i = 0; i < 120; i++) {
    const a = (i * 3 * Math.PI) / 180
    out.push(
      line(
        c + Math.cos(a) * (body - 10),
        c + Math.sin(a) * (body - 10),
        c + Math.cos(a) * R,
        c + Math.sin(a) * R,
      ),
    )
  }
  out.push(circle(c, c, body))
  out.push(circle(c, c, body - 110, LINE))
  out.push(circle(c, c, body - 190, LINE))
  out.push(circle(c, c, 300, LINE))
  out.push(circle(c, c, 150, LINE))
  return out
})

symbol('office-desk.svg', 1829, 813, (w, h) => [
  rect(E, E, w - 2 * E, h - 2 * E, { r: 15 }),
  box(w - E - 440, E + 25, w - E - 25, h - E - 25, HIDDEN),
  ...workstation(w * 0.42, E),
])

function workstation(cx, top) {
  return [
    rect(cx - 120, top + 70, 240, 170, { r: 25, fill: GREY, sw: 0.5 }),
    rect(cx - 300, top + 120, 600, 30, { r: 8, fill: INK, sw: 0.5 }),
    rect(cx - 225, top + 330, 450, 140, { r: 15, fill: GREY, sw: 0.5 }),
    ellipse(cx + 330, top + 400, 35, 55, { fill: GREY, sw: 0.5 }),
  ]
}

symbol('office-desk-l.svg', 1600, 1100, (w, h) => {
  const r = 300
  const main = 605 - 8
  const leg = 600 - 8
  const top = path(
    d`M${E} ${E + r} Q${E} ${E} ${E + r} ${E} L${w - E - 15} ${E} Q${w - E} ${E} ${w - E} ${E + 15} L${w - E} ${
      main - 15
    } Q${w - E} ${main} ${w - E - 15} ${main} L${leg + 40} ${main} Q${leg} ${main} ${leg} ${main + 40} L${leg} ${
      h - E - 15
    } Q${leg} ${h - E} ${leg - 15} ${h - E} L${E + 15} ${h - E} Q${E} ${h - E} ${E} ${h - E - 15} Z`,
  )
  return [top, box(E + 25, h - E - 470, leg - 25, h - E - 25, HIDDEN), ...workstation(w * 0.58, E)]
})

write()
