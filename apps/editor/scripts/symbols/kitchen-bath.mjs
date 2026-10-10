import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../public/symbols')
const U = 1 / 25.4
const INK = '#212121'
const GREY = '#e9e9e9'
const DARK_GREY = '#d6d6d6'
const WALL_DASH = '3 2'

const num = (mm) => String(Math.round(mm * U * 100) / 100)

const mul = ([a, b, c, d, e, f], [A, B, C, D, E, F]) => [
  a * A + c * B,
  b * A + d * B,
  a * C + c * D,
  b * C + d * D,
  a * E + c * F + e,
  b * E + d * F + f,
]
const move = (x, y) => [1, 0, 0, 1, x, y]
const quarter = (x, y) => [0, 1, -1, 0, x, y]
const turn = (deg) => {
  const r = (deg * Math.PI) / 180
  return [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]
}

class Pen {
  constructor() {
    this.out = []
    this.m = [1, 0, 0, 1, 0, 0]
  }

  at(m, draw) {
    const was = this.m
    this.m = mul(was, m)
    draw()
    this.m = was
  }

  p(x, y) {
    const [a, b, c, d, e, f] = this.m
    return [a * x + c * y + e, b * x + d * y + f]
  }

  swaps() {
    return Math.abs(this.m[1]) > 1e-9
  }

  style(s, sw) {
    const parts = []
    if (s.fill) parts.push(`fill="${s.fill}"`)
    if (s.stroke !== 'none') {
      parts.push(`stroke="${s.stroke ?? INK}"`, `stroke-width="${s.sw ?? sw}"`)
      if (s.dash) parts.push(`stroke-dasharray="${s.dash}"`)
      if (s.op) parts.push(`stroke-opacity="${s.op}"`)
    }
    return parts.join(' ')
  }

  rect(x, y, w, h, s = {}) {
    const [x1, y1] = this.p(x, y)
    const [x2, y2] = this.p(x + w, y + h)
    const r = s.rx ? ` rx="${num(s.rx)}"` : ''
    this.out.push(
      `<rect x="${num(Math.min(x1, x2))}" y="${num(Math.min(y1, y2))}" width="${num(Math.abs(x2 - x1))}" height="${num(Math.abs(y2 - y1))}"${r} ${this.style(s, 1)}/>`,
    )
  }

  circle(cx, cy, r, s = {}) {
    const [x, y] = this.p(cx, cy)
    this.out.push(`<circle cx="${num(x)}" cy="${num(y)}" r="${num(r)}" ${this.style(s, 1)}/>`)
  }

  ellipse(cx, cy, rx, ry, s = {}) {
    const [x, y] = this.p(cx, cy)
    const [a, b] = this.swaps() ? [ry, rx] : [rx, ry]
    this.out.push(
      `<ellipse cx="${num(x)}" cy="${num(y)}" rx="${num(a)}" ry="${num(b)}" ${this.style(s, 1)}/>`,
    )
  }

  line(x1, y1, x2, y2, s = {}) {
    const [a, b] = this.p(x1, y1)
    const [c, d] = this.p(x2, y2)
    this.out.push(
      `<line x1="${num(a)}" y1="${num(b)}" x2="${num(c)}" y2="${num(d)}" ${this.style(s, 0.5)}/>`,
    )
  }

  poly(points, s = {}) {
    const pts = points.map(([x, y]) => this.p(x, y).map(num).join(',')).join(' ')
    this.out.push(`<polygon points="${pts}" ${this.style(s, 1)}/>`)
  }

  path(cmds, s = {}) {
    const [a, b, c, d] = this.m
    const flip = a * d - b * c < 0
    const parts = cmds.map(([k, ...v]) => {
      if (k === 'Z') return 'Z'
      if (k === 'A') {
        const [rx, ry, rot, large, sweep, x, y] = v
        const [r1, r2] = this.swaps() ? [ry, rx] : [rx, ry]
        const [px, py] = this.p(x, y)
        return `A${num(r1)} ${num(r2)} ${rot} ${large} ${flip ? 1 - sweep : sweep} ${num(px)} ${num(py)}`
      }
      const pts = []
      for (let i = 0; i < v.length; i += 2)
        pts.push(
          this.p(v[i], v[i + 1])
            .map(num)
            .join(' '),
        )
      return k + pts.join(' ')
    })
    this.out.push(`<path d="${parts.join(' ')}" ${this.style(s, 1)}/>`)
  }
}

const roundedRect = (x, y, w, h, [tl, tr, br, bl]) => [
  ['M', x + tl, y],
  ['L', x + w - tr, y],
  ['A', tr, tr, 0, 0, 1, x + w, y + tr],
  ['L', x + w, y + h - br],
  ['A', br, br, 0, 0, 1, x + w - br, y + h],
  ['L', x + bl, y + h],
  ['A', bl, bl, 0, 0, 1, x, y + h - bl],
  ['L', x, y + tl],
  ['A', tl, tl, 0, 0, 1, x + tl, y],
  ['Z'],
]

function symbol(file, w, d, draw) {
  const pen = new Pen()
  draw(pen, w, d)
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(w)}" height="${num(d)}" viewBox="0 0 ${num(w)} ${num(d)}" fill="none" stroke-linejoin="round" stroke-linecap="round">`,
    ...pen.out.map((line) => `  ${line}`),
    '</svg>',
    '',
  ].join('\n')
  writeFileSync(join(OUT, file), svg)
}

const E = 12.7

function drain(pen, x, y, r = 24) {
  pen.circle(x, y, r, { fill: '#ffffff', sw: 0.5 })
  pen.circle(x, y, r * 0.35, { fill: INK, stroke: 'none' })
}

function tap(pen, x, y, reach, r = 22) {
  pen.rect(x - 10, y, 20, reach, { fill: DARK_GREY, sw: 0.5, rx: 10 })
  pen.circle(x, y, r, { fill: DARK_GREY, sw: 0.5 })
  pen.line(x + r * 0.7, y - r * 0.7, x + r * 2.4, y - r * 1.4, { sw: 1 })
}

function sink(pen, x, w, d, { bowls = 1, drainer = 'right' } = {}) {
  const top = 50
  const bottom = d - 60
  pen.rect(x + 30, top, w - 60, bottom - top, { fill: GREY, rx: 25 })
  const inner = w - 60
  const drainW = drainer ? inner * 0.4 : 0
  const bowlX = drainer === 'left' ? x + 30 + drainW : x + 30
  const bowlW = inner - drainW
  const each = bowlW / bowls
  for (let i = 0; i < bowls; i++) {
    const bx = bowlX + i * each
    const small = bowls === 2 && i === 1 ? 0.12 : 0
    const by = top + 75
    const bh = bottom - top - 105
    pen.rect(bx + 30, by + bh * small, each - 50, bh * (1 - small), { fill: DARK_GREY, rx: 45 })
    drain(pen, bx + 5 + each / 2, by + bh * (0.5 + small / 2), 22)
  }
  if (drainer) {
    const dx = drainer === 'left' ? x + 30 : x + 30 + bowlW
    for (let gx = dx + 45; gx < dx + drainW - 30; gx += 40)
      pen.line(gx, top + 70, gx, bottom - 50, { op: 0.6 })
  }
  tap(pen, bowlX + 5 + each / 2, top + 30, 190)
}

function hob(pen, cx, cy) {
  pen.rect(cx - 290, cy - 255, 580, 510, { fill: GREY, rx: 12 })
  const zones = [
    [-140, -115, 100],
    [145, -120, 72],
    [-145, 125, 72],
    [140, 115, 92],
  ]
  for (const [zx, zy, r] of zones) {
    pen.circle(cx + zx, cy + zy, r, { sw: 0.5 })
    pen.circle(cx + zx, cy + zy, r * 0.55, { sw: 0.5, op: 0.5 })
  }
}

function hood(pen, cx) {
  pen.rect(cx - 300, 0, 600, 500, { sw: 0.5, dash: WALL_DASH })
  pen.rect(cx - 220, 60, 440, 340, { sw: 0.5, dash: WALL_DASH })
}

function fridge(pen, x, w, d, handleAt = 'right') {
  const body = d - 35
  pen.rect(x, 0, w, body, { fill: '#ffffff' })
  pen.line(x + 30, body - 45, x + w - 30, body - 45, { sw: 0.5 })
  pen.line(x, 0, x + w, body - 45, { op: 0.35 })
  pen.line(x + w, 0, x, body - 45, { op: 0.35 })
  const hx = handleAt === 'right' ? x + w - 85 : x + 60
  pen.rect(hx, body, 25, 30, { fill: INK, stroke: 'none' })
}

function worktop(pen, x, w, d) {
  pen.rect(x, 0, w, d, { fill: '#ffffff' })
  pen.line(x, 22, x + w, 22)
}

function divisions(pen, xs, from, to) {
  for (const x of xs) pen.line(x, from, x, to, { op: 0.35 })
}

function wallCabinets(pen, x, w, splits = []) {
  pen.rect(x, 0, w, 350, { sw: 0.5, dash: WALL_DASH })
  for (const s of splits) pen.line(s, 0, s, 350, { dash: WALL_DASH })
}

function straightRun(pen, W, D, modules, withWall) {
  const wd = D - 40
  let x = E
  const across = []
  for (const m of modules) {
    m.x = x
    x += m.w
  }
  const last = modules[modules.length - 1]
  last.w = W - E - last.x
  const spans = []
  for (const m of modules) {
    if (m.kind === 'fridge') continue
    const open = spans[spans.length - 1]
    if (open && open.end === m.x) open.end = m.x + m.w
    else spans.push({ start: m.x, end: m.x + m.w })
  }
  pen.at(move(0, E), () => {
    for (const s of spans) worktop(pen, s.start, s.end - s.start, wd - E)
    for (let i = 1; i < modules.length; i++) {
      const a = modules[i - 1]
      const b = modules[i]
      if (a.kind !== 'fridge' && b.kind !== 'fridge') across.push(b.x)
    }
    divisions(pen, across, 22, wd - E)
    for (const m of modules) {
      if (m.kind === 'fridge') fridge(pen, m.x, m.w, D - E * 2, m.handle)
      if (m.kind === 'sink') sink(pen, m.x, m.w, wd - E, m)
      if (m.kind === 'hob') hob(pen, m.x + m.w / 2, (wd - E) / 2 + 10)
    }
    if (withWall) {
      for (const s of spans) {
        const hobs = modules.filter((m) => m.kind === 'hob' && m.x >= s.start && m.x < s.end)
        let from = s.start
        for (const h of [...hobs, { x: s.end, w: 0, end: true }]) {
          const to = h.end ? s.end : h.x + h.w / 2 - 300
          if (to - from > 1) {
            const splits = modules
              .filter((m) => m.x > from && m.x < to && m.kind !== 'hob')
              .map((m) => m.x)
            wallCabinets(pen, from, to - from, splits)
          }
          if (!h.end) {
            hood(pen, h.x + h.w / 2)
            from = h.x + h.w / 2 + 300
          }
        }
      }
    }
  })
}

const kitchenI = (withWall) => (pen, W, D) =>
  straightRun(
    pen,
    W,
    D,
    [
      { kind: 'fridge', w: 600 },
      { kind: 'cab', w: 600 },
      { kind: 'sink', w: 900, drainer: 'left' },
      { kind: 'cab', w: 600 },
      { kind: 'hob', w: 600 },
      { kind: 'cab', w: 0 },
    ],
    withWall,
  )

const kitchenIMini = (withWall) => (pen, W, D) =>
  straightRun(
    pen,
    W,
    D,
    [
      { kind: 'fridge', w: 600 },
      { kind: 'cab', w: 450 },
      { kind: 'sink', w: 800, drainer: 'left' },
      { kind: 'hob', w: 600 },
      { kind: 'cab', w: 0 },
    ],
    withWall,
  )

function kitchenL(withWall) {
  return (pen, W, D) => {
    const top = 0.25 * D - E
    const leg = 0.25 * W - 50
    const fx = leg + 10
    const fw = 0.4375 * W - fx - 10
    pen.poly(
      [
        [E, E],
        [fx, E],
        [fx, top],
        [leg, top],
        [leg, D - E],
        [E, D - E],
      ],
      { fill: '#ffffff' },
    )
    pen.poly(
      [
        [fx + fw, E],
        [W - E, E],
        [W - E, top],
        [fx + fw, top],
      ],
      { fill: '#ffffff' },
    )
    pen.line(E, top, leg, top)
    pen.line(E, E + 22, fx, E + 22)
    pen.line(fx + fw, E + 22, W - E, E + 22)
    pen.line(E + 22, top, E + 22, D - E)
    pen.at(move(0, E), () => fridge(pen, fx, fw, top - E + 35, 'right'))
    const sinkX = fx + fw + 250
    pen.at(move(0, E), () => {
      sink(pen, sinkX, 1000, top - E, { drainer: 'right' })
      divisions(pen, [sinkX, sinkX + 1000, sinkX + 1600], 22, top - E)
    })
    const hobY = 0.62 * D
    pen.at(quarter(leg, 0), () => hob(pen, hobY, (leg - E) / 2 + 10))
    for (const y of [top + 600, hobY - 300, hobY + 300]) pen.line(E + 22, y, leg, y, { op: 0.35 })
    if (withWall) {
      pen.rect(fx + fw, E, W - E - fx - fw, 350, { sw: 0.5, dash: WALL_DASH })
      pen.rect(E, E, fx - E, 350, { sw: 0.5, dash: WALL_DASH })
      pen.rect(E, E + 350, 350, hobY - 300 - E - 350, { sw: 0.5, dash: WALL_DASH })
      pen.rect(E, hobY - 300, 500, 600, { sw: 0.5, dash: WALL_DASH })
      pen.rect(E + 60, hobY - 220, 340, 440, { sw: 0.5, dash: WALL_DASH })
      pen.rect(E, hobY + 300, 350, D - E - hobY - 300, { sw: 0.5, dash: WALL_DASH })
    }
  }
}

function kitchenLMini(withWall) {
  return (pen, W, D) => {
    const deep = 0.375 * D - E
    const leg = 0.3125 * W - E
    const run = 0.6875 * W
    pen.poly(
      [
        [E, E],
        [run, E],
        [run, deep],
        [leg, deep],
        [leg, D - E],
        [E, D - E],
      ],
      { fill: '#ffffff' },
    )
    pen.line(E, deep, leg, deep)
    pen.line(E, E + 22, run, E + 22)
    pen.line(E + 22, deep, E + 22, D - E)
    const fx = run + 10
    const fw = W - E - fx
    const body = 0.3125 * D - E
    pen.rect(fx, E, fw, body - E, { fill: '#ffffff' })
    pen.line(fx + 30, body - 45, fx + fw - 30, body - 45)
    pen.line(fx, E, fx + fw, body - 45, { op: 0.35 })
    pen.line(fx + fw, E, fx, body - 45, { op: 0.35 })
    pen.rect(0.8125 * W + 45, body, 30, 0.375 * D - body - E - 30, { fill: INK, stroke: 'none' })
    const sinkX = leg + 60
    pen.at(move(0, E), () => {
      sink(pen, sinkX, run - sinkX - 40, deep - E, { drainer: 'right' })
      divisions(pen, [sinkX - 30], 22, deep - E)
    })
    const hobY = 0.66 * D
    pen.at(quarter(leg, 0), () => hob(pen, hobY, (leg - E) / 2 + 10))
    for (const y of [hobY - 300, hobY + 300]) pen.line(E + 22, y, leg, y, { op: 0.35 })
    if (withWall) {
      pen.rect(E, E, run - E, 350, { sw: 0.5, dash: WALL_DASH })
      pen.line(sinkX - 30, E, sinkX - 30, E + 350, { dash: WALL_DASH })
      pen.rect(E, E + 350, 350, hobY - 300 - E - 350, { sw: 0.5, dash: WALL_DASH })
      pen.rect(E, hobY - 300, 500, 600, { sw: 0.5, dash: WALL_DASH })
      pen.rect(E + 60, hobY - 220, 340, 440, { sw: 0.5, dash: WALL_DASH })
      pen.rect(E, hobY + 300, 350, D - E - hobY - 300, { sw: 0.5, dash: WALL_DASH })
    }
  }
}

function kitchenU(withWall) {
  return (pen, W, D) => {
    const top = 0.25 * D - E
    const legL = 0.25 * W - 40
    const legR = 0.75 * W + 40
    const fridgeY = D - E - 650
    pen.poly(
      [
        [E, E],
        [W - E, E],
        [W - E, D - E],
        [legR, D - E],
        [legR, top],
        [legL, top],
        [legL, fridgeY],
        [E, fridgeY],
      ],
      { fill: '#ffffff' },
    )
    pen.line(E, top, legL, top)
    pen.line(legR, top, W - E, top)
    pen.line(E, E + 22, W - E, E + 22)
    pen.line(E + 22, top, E + 22, fridgeY)
    pen.line(W - E - 22, top, W - E - 22, D - E)
    pen.at(quarter(legL, fridgeY - 5), () => fridge(pen, 5, 650 - 5, legL - E + 30, 'left'))
    const sinkX = W / 2 - 500
    pen.at(move(0, E), () => {
      sink(pen, sinkX, 1000, top - E, { bowls: 2, drainer: null })
      divisions(pen, [sinkX, sinkX + 1000, sinkX + 1600], 22, top - E)
    })
    const hobY = 0.6 * D
    pen.at(quarter(W - E, 0), () => hob(pen, hobY, (W - E - legR) / 2 + 10))
    for (const y of [hobY - 300, hobY + 300]) pen.line(legR, y, W - E - 22, y, { op: 0.35 })
    for (const y of [top + 600, top + 1200]) pen.line(E + 22, y, legL, y, { op: 0.35 })
    if (withWall) {
      const dash = { sw: 0.5, dash: WALL_DASH }
      pen.rect(E, E, W - 2 * E, 350, dash)
      pen.line(sinkX, E, sinkX, E + 350, { dash: WALL_DASH })
      pen.line(sinkX + 1000, E, sinkX + 1000, E + 350, { dash: WALL_DASH })
      pen.rect(E, E + 350, 350, fridgeY - E - 350, dash)
      pen.rect(W - E - 350, E + 350, 350, hobY - 300 - E - 350, dash)
      pen.rect(W - E - 500, hobY - 300, 500, 600, dash)
      pen.rect(W - E - 440, hobY - 220, 340, 440, dash)
      pen.rect(W - E - 350, hobY + 300, 350, D - E - hobY - 300, dash)
    }
  }
}

function counterStraight(pen, W, D) {
  worktop(pen, E, W - 2 * E, D - 2 * E)
  const n = Math.max(1, Math.round((W - 2 * E) / 600))
  const step = (W - 2 * E) / n
  divisions(
    pen,
    Array.from({ length: n - 1 }, (_, i) => E + step * (i + 1)),
    E + 22,
    D - E,
  )
}

function counterL(pen, W, D) {
  const top = 0.5625 * D
  const leg = 0.3125 * W
  pen.poly(
    [
      [E, E],
      [W - E, E],
      [W - E, top],
      [leg, top],
      [leg, D - E],
      [E, D - E],
    ],
    { fill: '#ffffff' },
  )
  pen.line(E, E + 22, W - E, E + 22)
  pen.line(E + 22, E + 22, E + 22, D - E)
  pen.line(E, top, leg, top, { op: 0.35 })
  divisions(pen, [leg + 600, leg + 1200], E + 22, top)
}

function kitchenSink(pen, W, D) {
  pen.at(move(0, E), () => {
    worktop(pen, E, W - 2 * E, D - 2 * E)
    const sx = W / 2 - 600
    sink(pen, sx, 1200, D - 2 * E, { bowls: 2, drainer: 'right' })
    divisions(pen, [sx, sx + 1200], 22, D - 2 * E)
  })
}

function stove(pen, W, D) {
  const front = D - 45
  pen.rect(E, E, W - 2 * E, front - E, { fill: '#ffffff', rx: 10 })
  pen.rect(E, E, W - 2 * E, 80, { fill: '#ffffff' })
  for (let i = 0; i < 4; i++)
    pen.circle(E + 110 + i * ((W - 2 * E - 220) / 3), E + 40, 16, { fill: DARK_GREY, sw: 0.5 })
  pen.rect(50, E + 110, W - 100, front - E - 150, { fill: GREY, rx: 8 })
  const cx = W / 2
  const cy = (E + 110 + front - 40) / 2
  for (const [dx, dy, r] of [
    [-165, -140, 95],
    [165, -140, 75],
    [-165, 140, 75],
    [165, 140, 95],
  ]) {
    pen.circle(cx + dx, cy + dy, r, { sw: 0.5 })
    pen.circle(cx + dx, cy + dy, r * 0.5, { sw: 0.5 })
    pen.circle(cx + dx, cy + dy, 10, { fill: INK, stroke: 'none' })
  }
  pen.line(cx, E + 120, cx, front - 50, { op: 0.4 })
  pen.line(60, cy, W - 60, cy, { op: 0.4 })
  pen.rect(90, front + 5, W - 180, 22, { fill: INK, stroke: 'none', rx: 8 })
}

function refrigerator(pen, W, D) {
  const body = D - 45
  pen.rect(E, E, W - 2 * E, body - E, { fill: '#ffffff', rx: 8 })
  pen.line(E + 20, body - 50, W - E - 20, body - 50)
  pen.line(E, E, W - E, body - 50, { op: 0.35 })
  pen.line(W - E, E, E, body - 50, { op: 0.35 })
  pen.rect(W - 95, body, 28, 34, { fill: INK, stroke: 'none' })
}

function dishwasher(pen, W, D) {
  const body = D - 40
  pen.rect(E, E, W - 2 * E, body - E, { fill: '#ffffff', rx: 8 })
  pen.line(E + 20, body - 45, W - E - 20, body - 45)
  pen.rect(E + 20, E + 20, W - 2 * E - 40, 70, { fill: GREY, sw: 0.5 })
  pen.circle(W - 90, E + 55, 14, { fill: DARK_GREY, sw: 0.5 })
  const cy = (E + 100 + body - 45) / 2
  pen.line(W / 2 - 200, cy, W / 2 + 200, cy, { dash: '3 2' })
  pen.circle(W / 2, cy, 30, { sw: 0.5, dash: '3 2' })
  pen.rect(W / 2 - 160, body, 320, 24, { fill: INK, stroke: 'none', rx: 8 })
}

function laundryUnit(pen, x, w, D, dryer) {
  const body = D - 115
  pen.rect(x, E, w, body - E, { fill: '#ffffff', rx: 15 })
  pen.rect(x + 20, E + 20, w - 40, 90, { fill: GREY, sw: 0.5 })
  if (!dryer) {
    pen.rect(x + 35, E + 32, 170, 66, { fill: DARK_GREY, sw: 0.5 })
    pen.line(x + 90, E + 32, x + 90, E + 98, { op: 0.6 })
    pen.line(x + 145, E + 32, x + 145, E + 98, { op: 0.6 })
  } else {
    pen.rect(x + 35, E + 40, 130, 50, { fill: DARK_GREY, sw: 0.5 })
  }
  pen.circle(x + w - 90, E + 65, 30, { fill: '#ffffff', sw: 0.5 })
  pen.line(x + w - 90, E + 65, x + w - 90, E + 40, { sw: 0.5 })
  const cy = (E + 140 + body) / 2
  const r = Math.min(w, body - E - 140) / 2 - 40
  pen.circle(x + w / 2, cy, r, { sw: 0.5, dash: '3 2' })
  const door = Math.min(500, w - 120)
  pen.rect(x + w / 2 - door / 2, body - 10, door, 90, { fill: '#ffffff', rx: 30 })
  pen.rect(x + w / 2 - door / 2 + 30, body + 10, door - 60, 50, { fill: GREY, sw: 0.5, rx: 20 })
  pen.rect(x + w / 2 + door / 2 - 60, body + 80, 40, 22, { fill: INK, stroke: 'none' })
}

function washerDryer(pen, W, D) {
  const each = (W - 2 * E - 30) / 2
  laundryUnit(pen, E, each, D, false)
  laundryUnit(pen, E + each + 30, each, D, true)
}

function washerDryerStacked(pen, W, D) {
  laundryUnit(pen, E, W - 2 * E, D, true)
}

function waterHeater(pen, W, D) {
  const cx = W / 2
  const cy = D / 2 + 5
  const r = Math.min(W, D) / 2 - E - 5
  pen.circle(cx, cy, r, { fill: '#ffffff' })
  pen.circle(cx, cy, r - 40, { sw: 0.5 })
  pen.circle(cx, cy, 70, { fill: GREY, sw: 0.5 })
  pen.circle(cx, cy, 45, { sw: 0.5 })
  for (const dx of [-150, 150]) {
    pen.circle(cx + dx, cy - 140, 26, { fill: DARK_GREY, sw: 0.5 })
    pen.line(cx + dx, cy - 166, cx + dx, E + 5, { sw: 1 })
  }
  pen.rect(cx + r - 70, cy - 30, 70, 30, { fill: DARK_GREY, sw: 0.5 })
}

function hvac(pen, W, D) {
  pen.rect(E, E, W - 2 * E, D - 2 * E, { fill: '#ffffff', rx: 10 })
  const fx = (D - 2 * E) / 2 + E
  const cy = D / 2
  const R = D / 2 - 50
  pen.circle(fx, cy, R, { fill: GREY })
  for (const k of [0.78, 0.56]) pen.circle(fx, cy, R * k, { sw: 0.5 })
  for (let i = 0; i < 3; i++) {
    pen.at(mul(move(fx, cy), turn(i * 120)), () =>
      pen.path(
        [
          ['M', 0, -40],
          ['Q', R * 0.5, -R * 0.55, R * 0.85, -R * 0.1],
          ['Q', R * 0.45, R * 0.05, 0, 40],
          ['Z'],
        ],
        { fill: '#ffffff', sw: 0.5 },
      ),
    )
  }
  pen.circle(fx, cy, 45, { fill: DARK_GREY, sw: 0.5 })
  const gx = fx + R + 50
  pen.rect(gx, 50, W - E - 40 - gx, D - 100, { fill: '#ffffff', sw: 0.5 })
  for (let y = 85; y < D - 60; y += 36) pen.line(gx + 15, y, W - E - 55, y, { op: 0.6 })
  for (const dx of [0, 60]) pen.circle(W - E - 120 + dx, E + 30, 14, { fill: DARK_GREY, sw: 0.5 })
}

function barCounter(pen, x, W, D) {
  const back = D - 210
  pen.rect(x, E, W, back - E, { fill: '#ffffff' })
  pen.line(x, E + 22, x + W, E + 22)
  pen.rect(x, back, W, D - E - back, { fill: '#ffffff', rx: 20 })
  pen.line(x + 30, back + 40, x + W - 30, back + 40, { op: 0.35 })
  const sx = x + W * 0.32
  const sy = (E + 22 + back) / 2 + 15
  pen.rect(sx - 190, sy - 150, 380, 300, { fill: GREY, rx: 30 })
  pen.rect(sx - 150, sy - 100, 300, 230, { fill: DARK_GREY, rx: 40 })
  drain(pen, sx, sy + 15, 20)
  tap(pen, sx, sy - 128, 120, 18)
  divisions(pen, [x + W * 0.32 - 300, x + W * 0.32 + 300, x + W * 0.66], E + 22, back)
}

function bar(pen, W, D) {
  barCounter(pen, E, W - 2 * E, D)
}

function stool(pen, x, y) {
  pen.circle(x, y, 205, { sw: 0.5 })
  pen.circle(x, y, 175, { fill: '#ffffff' })
  pen.circle(x, y, 130, { sw: 0.5, op: 0.6 })
}

function island(pen, x, y, w, d, stools, withSink, sinkW) {
  const seat = y + d + 175 - 60
  for (let i = 0; i < stools; i++) stool(pen, x + (w * (i + 0.5)) / stools, seat)
  pen.rect(x, y, w, d, { fill: '#ffffff', rx: 10 })
  pen.line(x + 30, y + d - 300, x + w - 30, y + d - 300, { dash: '3 2' })
  pen.line(x + 30, y + 30, x + 30, y + d - 300, { dash: '3 2', op: 0.6 })
  pen.line(x + w - 30, y + 30, x + w - 30, y + d - 300, { dash: '3 2', op: 0.6 })
  if (withSink) {
    const cx = x + w / 2
    pen.rect(cx - sinkW / 2, y + 120, sinkW, 440, { fill: GREY, rx: 25 })
    const bowls = sinkW > 800 ? 2 : 1
    const each = (sinkW - 40) / bowls
    for (let i = 0; i < bowls; i++) {
      const bx = cx - sinkW / 2 + 20 + i * each
      pen.rect(bx + 15, y + 180, each - 30, 350, { fill: DARK_GREY, rx: 40 })
      drain(pen, bx + each / 2, y + 360, 22)
    }
    tap(pen, cx, y + 150, 150)
  }
}

const islandSymbol = (stools, withSink) => (pen, W, D) => {
  const d = D - E - 390 + 40
  island(pen, E, E, W - 2 * E, d, stools, withSink, stools > 2 ? 900 : 560)
}

function barIsland(pen, W, D) {
  barCounter(pen, E, W - 2 * E, 635)
  island(pen, 220, 1350, W - 440, 650, 3, false)
}

function toilet(pen, W, D) {
  const cx = W / 2
  pen.rect(cx - 130, 170, 260, 140, { fill: '#ffffff' })
  pen.ellipse(cx, 470, 188, D - 470 - E, { fill: '#ffffff' })
  pen.ellipse(cx, 482, 172, D - 482 - E - 18, { fill: '#ffffff', sw: 0.5 })
  pen.ellipse(cx, 505, 112, 165, { fill: GREY })
  for (const dx of [-95, 95]) pen.rect(cx + dx - 18, 225, 36, 28, { fill: DARK_GREY, sw: 0.5 })
  pen.rect(E, E, W - 2 * E, 185, { fill: '#ffffff', rx: 25 })
  pen.circle(cx, E + 92, 32, { fill: GREY, sw: 0.5 })
  pen.line(cx, E + 60, cx, E + 124)
}

function vanity(basins) {
  return (pen, W, D) => {
    pen.rect(E, E, W - 2 * E, D - 2 * E, { fill: '#ffffff' })
    pen.line(E, E + 25, W - E, E + 25)
    for (let i = 0; i < basins; i++) {
      const cx = (W * (i + 0.5)) / basins
      const cy = D * 0.56
      pen.ellipse(cx, cy, 215, 165, { fill: GREY })
      pen.ellipse(cx, cy + 15, 165, 120, { sw: 0.5 })
      drain(pen, cx, cy + 20, 18)
      tap(pen, cx, E + 80, cy - 165 - E - 80 + 70, 24)
    }
  }
}

function bathtub(pen, W, D) {
  pen.rect(E, E, W - 2 * E, D - 2 * E, { fill: '#ffffff' })
  const ix = 75
  pen.path(roundedRect(ix, ix, W - 2 * ix, D - 2 * ix, [110, 260, 260, 110]), { fill: GREY })
  pen.path(roundedRect(ix + 70, ix + 70, W - 2 * ix - 140, D - 2 * ix - 140, [70, 200, 200, 70]), {
    sw: 0.5,
  })
  drain(pen, ix + 150, D / 2, 26)
  tap(pen, ix + 150, 38, 100, 20)
}

function bathtubFree(pen, W, D) {
  pen.rect(E, E, W - 2 * E, D - 2 * E, { fill: '#ffffff', rx: (D - 2 * E) / 2 - 20 })
  const ix = 85
  pen.rect(ix, ix, W - 2 * ix, D - 2 * ix, { fill: GREY, rx: (D - 2 * ix) / 2 - 30 })
  pen.rect(ix + 80, ix + 70, W - 2 * ix - 160, D - 2 * ix - 140, {
    sw: 0.5,
    rx: (D - 2 * ix - 140) / 2 - 20,
  })
  drain(pen, W / 2, D / 2, 26)
  tap(pen, W / 2, 45, 110, 20)
}

function shower(cornerGlass) {
  return (pen, W, D) => {
    pen.rect(E, E, W - 2 * E, D - 2 * E, { fill: '#ffffff', rx: 15 })
    const i = 55
    pen.rect(i, i, W - 2 * i, D - 2 * i, { fill: GREY, sw: 0.5, rx: 25 })
    const cx = W / 2
    const cy = D / 2
    for (const [x, y] of [
      [i, i],
      [W - i, i],
      [W - i, D - i],
      [i, D - i],
    ])
      pen.line(x, y, cx, cy, { op: 0.45 })
    pen.circle(cx, cy, 50, { fill: '#ffffff', sw: 0.5 })
    pen.circle(cx, cy, 32, { sw: 0.5 })
    pen.circle(cx, cy, 10, { fill: INK, stroke: 'none' })
    pen.rect(cx - 70, E, 140, 35, { fill: DARK_GREY, sw: 0.5 })
    pen.circle(cx, E + 35 + 170, 120, { sw: 0.5, dash: '3 2' })
    const g = 10
    const gy = D - E - 30
    const split = cornerGlass ? W * 0.45 : W * 0.5
    pen.rect(E + 15, gy - g, split + 40 - E - 15, g, { fill: GREY, sw: 0.5 })
    pen.rect(split - 40, gy - 2 * g - 8, W - E - 15 - split + 40, g, { fill: GREY, sw: 0.5 })
    pen.rect(split + 10, gy - 2 * g - 30, 14, 22, { fill: INK, stroke: 'none' })
    if (cornerGlass) pen.rect(W - E - 30 - g, E + 15, g, D - 2 * E - 50, { fill: GREY, sw: 0.5 })
  }
}

const SYMBOLS = [
  ['kitchen-i.svg', 3797, 737, kitchenI(false)],
  ['kitchen-i-wall.svg', 3797, 737, kitchenI(true)],
  ['kitchen-i-mini.svg', 2845, 762, kitchenIMini(false)],
  ['kitchen-i-mini-wall.svg', 2845, 762, kitchenIMini(true)],
  ['kitchen-l.svg', 3251, 2565, kitchenL(false)],
  ['kitchen-l-mini.svg', 2388, 2032, kitchenLMini(false)],
  ['kitchen-l-mini-wall.svg', 2388, 2032, kitchenLMini(true)],
  ['kitchen-u.svg', 3226, 3023, kitchenU(false)],
  ['kitchen-u-wall.svg', 3226, 3023, kitchenU(true)],
  ['kitchen-sink.svg', 2489, 737, kitchenSink],
  ['counter-straight.svg', 1245, 711, counterStraight],
  ['counter-l.svg', 2515, 1245, counterL],
  ['stove.svg', 762, 737, stove],
  ['refrigerator.svg', 711, 686, refrigerator],
  ['dishwasher.svg', 635, 660, dishwasher],
  ['washer-dryer.svg', 1549, 889, washerDryer],
  ['washer-dryer-stacked.svg', 737, 889, washerDryerStacked],
  ['water-heater.svg', 635, 635, waterHeater],
  ['hvac.svg', 1016, 610, hvac],
  ['bar.svg', 2057, 635, bar],
  ['bar-island.svg', 2057, 2565, barIsland],
  ['island-2.svg', 1422, 1397, islandSymbol(2, false)],
  ['island-2-sink.svg', 1422, 1397, islandSymbol(2, true)],
  ['island-4.svg', 2794, 1397, islandSymbol(4, false)],
  ['island-4-sink.svg', 2794, 1397, islandSymbol(4, true)],
  ['toilet-tank.svg', 483, 737, toilet],
  ['vanity-sink.svg', 813, 635, vanity(1)],
  ['vanity-double.svg', 1575, 635, vanity(2)],
  ['bathtub.svg', 1549, 838, bathtub],
  ['bathtub-free.svg', 1549, 914, bathtubFree],
  ['shower-s.svg', 838, 838, shower(true)],
  ['shower-m.svg', 1143, 1143, shower(true)],
  ['shower-l.svg', 1549, 940, shower(false)],
]

for (const [file, w, d, draw] of SYMBOLS) symbol(file, w, d, draw)
