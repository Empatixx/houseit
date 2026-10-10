import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../public/symbols')
const U = 1 / 25.4
const INK = '#212121'
const FINISH = '#ffffff'
const GREY = '#e9e9e9'
const DARK_GREY = '#d6d6d6'
const WALL_DASH = '3 2'
const E = 12.7

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
    const r = s.rx ? ` rx="${num(Math.min(s.rx, w / 2, h / 2))}"` : ''
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

  smooth(points, r, s = {}) {
    const cmds = []
    const n = points.length
    points.forEach((p, i) => {
      const prev = points[(i + n - 1) % n]
      const next = points[(i + 1) % n]
      const toward = (q) => {
        const len = Math.hypot(q[0] - p[0], q[1] - p[1])
        const k = Math.min(r, len / 2) / len
        return [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]
      }
      const a = toward(prev)
      const b = toward(next)
      cmds.push([i === 0 ? 'M' : 'L', ...a], ['Q', ...p, ...b])
    })
    cmds.push(['Z'])
    this.path(cmds, s)
  }

  curve(points, s = {}) {
    this.path([['M', ...points[0]], ...points.slice(1).map((p) => ['L', ...p]), ['Z']], s)
  }
}

function superellipse(cx, cy, a, b, n, steps = 96) {
  return Array.from({ length: steps }, (_, i) => {
    const t = (i / steps) * Math.PI * 2
    const c = Math.cos(t)
    const s = Math.sin(t)
    return [
      cx + a * Math.sign(c) * Math.abs(c) ** (2 / n),
      cy + b * Math.sign(s) * Math.abs(s) ** (2 / n),
    ]
  })
}

function egg(cx, cy, a, b, k, steps = 96) {
  return Array.from({ length: steps }, (_, i) => {
    const t = (i / steps) * Math.PI * 2
    return [cx + a * Math.sin(t) * (1 + k * Math.cos(t)), cy - b * Math.cos(t)]
  })
}

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

const SOFT = { sw: 0.5, op: 0.45 }
const FAINT = { sw: 0.5, op: 0.3 }

function drain(pen, x, y, r = 24) {
  pen.circle(x, y, r, { fill: FINISH, sw: 0.5 })
  pen.circle(x, y, r * 0.6, { sw: 0.5, op: 0.6 })
  pen.circle(x, y, r * 0.22, { fill: INK, stroke: 'none' })
}

function tap(pen, x, y, reach, r = 22) {
  const end = [x + reach * 0.12, y + reach]
  const spout = [
    ['M', x, y],
    ['Q', x + reach * 0.4, y + reach * 0.45, ...end],
  ]
  pen.path(spout, { sw: 0.95 })
  pen.path(spout, { stroke: GREY, sw: 0.5 })
  pen.circle(...end, 11, { fill: GREY, sw: 0.5 })
  pen.circle(x, y, r, { fill: GREY, sw: 0.5 })
  pen.circle(x, y, r * 0.45, { sw: 0.5, op: 0.6 })
  pen.path(
    [
      ['M', x + r * 0.6, y - r * 0.6],
      ['Q', x + r * 1.6, y - r * 1.1, x + r * 2.4, y - r * 0.9],
    ],
    { sw: 1 },
  )
}

function pill(pen, x, y, w, h) {
  pen.rect(x, y, w, h, { fill: DARK_GREY, sw: 0.5, rx: Math.min(w, h) / 2 })
}

function knob(pen, x, y, r = 18) {
  pen.circle(x, y, r, { fill: FINISH, sw: 0.5 })
  pen.line(x, y, x, y - r * 0.75, { sw: 0.5 })
}

function sink(pen, x, w, d, { bowls = 1, drainer = 'right' } = {}) {
  const top = 48
  const bottom = d - 62
  pen.rect(x + 30, top, w - 60, bottom - top, { fill: GREY, sw: 0.5, rx: 60 })
  pen.rect(x + 30, top, w - 60, bottom - top, { rx: 60, sw: 1 })
  const inner = w - 60
  const drainW = drainer ? inner * 0.4 : 0
  const bowlX = drainer === 'left' ? x + 30 + drainW : x + 30
  const bowlW = inner - drainW
  const each = bowlW / bowls
  for (let i = 0; i < bowls; i++) {
    const bx = bowlX + i * each
    const small = bowls === 2 && i === 1 ? 0.14 : 0
    const by = top + 78
    const bh = bottom - top - 110
    pen.rect(bx + 30, by + bh * small, each - 50, bh * (1 - small), {
      fill: DARK_GREY,
      sw: 0.5,
      rx: 75,
    })
    pen.rect(bx + 52, by + bh * small + 22, each - 94, bh * (1 - small) - 44, { ...FAINT, rx: 60 })
    drain(pen, bx + 5 + each / 2, by + bh * (0.55 + small / 2), 24)
  }
  if (drainer) {
    const dx = drainer === 'left' ? x + 30 : x + 30 + bowlW
    for (let gx = dx + 40; gx < dx + drainW - 40; gx += 42)
      pen.rect(gx, top + 85, 16, bottom - top - 150, { sw: 0.5, op: 0.6, rx: 8 })
  }
  tap(pen, bowlX + 5 + each / 2, top + 34, 170)
}

function hob(pen, cx, cy) {
  pen.rect(cx - 290, cy - 255, 580, 510, { fill: GREY, rx: 40 })
  const zones = [
    [-140, -105, 108],
    [148, -118, 74],
    [-148, 128, 74],
    [140, 105, 94],
  ]
  for (const [zx, zy, r] of zones) {
    pen.circle(cx + zx, cy + zy, r, { sw: 0.5 })
    pen.circle(cx + zx, cy + zy, r * 0.7, SOFT)
    pen.circle(cx + zx, cy + zy, r * 0.4, FAINT)
  }
  for (let i = 0; i < 4; i++) pen.circle(cx - 45 + i * 30, cy + 215, 8, { sw: 0.5, op: 0.6 })
}

function hood(pen, cx, from = 0) {
  pen.rect(cx - 300, from, 600, 500, { sw: 0.5, dash: WALL_DASH, rx: 30 })
  pen.rect(cx - 220, from + 70, 440, 330, { sw: 0.5, dash: WALL_DASH, rx: 20 })
}

function fridgeTop(pen, x, y, w, depth, handleAt = 'right') {
  const body = depth - 42
  pen.rect(x, y, w, body, { fill: FINISH, rx: 40 })
  pen.rect(x + 30, y + 30, w - 60, body - 110, { ...FAINT, rx: 25 })
  pen.line(x + 22, y + body - 55, x + w - 22, y + body - 55, { sw: 0.5, op: 0.6 })
  const hx = handleAt === 'right' ? x + w - 90 : x + 64
  pill(pen, hx, y + body - 40, 26, 78)
}

function worktop(pen, x, y, w, d) {
  pen.rect(x, y, w, d, { fill: FINISH, rx: 25 })
  pen.line(x + 22, y + 22, x + w - 22, y + 22, SOFT)
  pen.line(x + 30, y + d - 28, x + w - 30, y + d - 28, SOFT)
}

function edgeLine(pen, x1, y1, x2, y2) {
  pen.line(x1, y1, x2, y2, SOFT)
}

function divisions(pen, xs, from, to) {
  for (const x of xs) pen.line(x, from, x, to, FAINT)
}

function wallCabinets(pen, x, w, splits = [], y = 0) {
  pen.rect(x, y, w, 350, { sw: 0.5, dash: WALL_DASH, rx: 15 })
  for (const s of splits) pen.line(s, y, s, y + 350, { dash: WALL_DASH })
}

function straightRun(pen, W, D, modules, withWall) {
  const wd = D - 40
  let x = E
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
  const across = []
  for (let i = 1; i < modules.length; i++) {
    if (modules[i - 1].kind !== 'fridge' && modules[i].kind !== 'fridge') across.push(modules[i].x)
  }
  pen.at(move(0, E), () => {
    for (const s of spans) worktop(pen, s.start, 0, s.end - s.start, wd - E)
    divisions(pen, across, 22, wd - E - 28)
    for (const m of modules) {
      if (m.kind === 'fridge') fridgeTop(pen, m.x + 8, 0, m.w - 16, D - E * 2, m.handle)
      if (m.kind === 'sink') sink(pen, m.x, m.w, wd - E, m)
      if (m.kind === 'hob') hob(pen, m.x + m.w / 2, (wd - E) / 2)
    }
    if (withWall) {
      for (const s of spans) {
        const hobs = modules.filter((m) => m.kind === 'hob' && m.x >= s.start && m.x < s.end)
        let from = s.start
        for (const h of [...hobs, { end: true }]) {
          const to = h.end ? s.end : h.x + h.w / 2 - 300
          if (to - from > 1) {
            const splits = modules.filter((m) => m.x > from && m.x < to).map((m) => m.x)
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

function legWall(pen, x, from, hobY, to) {
  const dash = { sw: 0.5, dash: WALL_DASH, rx: 15 }
  pen.rect(x, from, 350, hobY - 300 - from, dash)
  pen.at(quarter(x + 500, 0), () => hood(pen, hobY))
  pen.rect(x, hobY + 300, 350, to - hobY - 300, dash)
}

function kitchenL(withWall) {
  return (pen, W, D) => {
    const top = 0.25 * D - E
    const leg = 0.25 * W - 50
    const fx = leg + 10
    const fw = 0.4375 * W - fx - 10
    pen.smooth(
      [
        [E, E],
        [fx, E],
        [fx, top],
        [leg, top],
        [leg, D - E],
        [E, D - E],
      ],
      25,
      { fill: FINISH },
    )
    pen.rect(fx + fw, E, W - E - fx - fw, top - E, { fill: FINISH, rx: 25 })
    edgeLine(pen, E + 22, E + 22, fx - 10, E + 22)
    edgeLine(pen, fx + fw + 22, E + 22, W - E - 22, E + 22)
    edgeLine(pen, E + 22, E + 22, E + 22, D - E - 22)
    edgeLine(pen, leg - 28, top + 28, leg - 28, D - E - 30)
    edgeLine(pen, fx + fw + 30, top - 28, W - E - 30, top - 28)
    pen.line(E + 22, top, leg, top, FAINT)
    fridgeTop(pen, fx, E, fw, top - E + 42, 'right')
    const sinkX = fx + fw + 250
    pen.at(move(0, E), () => {
      sink(pen, sinkX, 1000, top - E, { drainer: 'right' })
      divisions(pen, [sinkX, sinkX + 1000, sinkX + 1600], 22, top - E - 28)
    })
    const hobY = 0.62 * D
    pen.at(quarter(leg, 0), () => hob(pen, hobY, (leg - E) / 2))
    for (const y of [top + 600, hobY - 300, hobY + 300]) pen.line(E + 22, y, leg - 28, y, FAINT)
    if (withWall) {
      wallCabinets(pen, fx + fw, W - E - fx - fw, [], E)
      wallCabinets(pen, E, fx - E, [], E)
      legWall(pen, E, E + 350, hobY, D - E)
    }
  }
}

function kitchenLMini(withWall) {
  return (pen, W, D) => {
    const deep = 0.375 * D - E
    const leg = 0.3125 * W - E
    const run = 0.6875 * W
    pen.smooth(
      [
        [E, E],
        [run, E],
        [run, deep],
        [leg, deep],
        [leg, D - E],
        [E, D - E],
      ],
      25,
      { fill: FINISH },
    )
    edgeLine(pen, E + 22, E + 22, run - 22, E + 22)
    edgeLine(pen, E + 22, E + 22, E + 22, D - E - 22)
    edgeLine(pen, leg + 30, deep - 28, run - 30, deep - 28)
    edgeLine(pen, leg - 28, deep + 30, leg - 28, D - E - 30)
    pen.line(E + 22, deep, leg, deep, FAINT)
    const fx = run + 10
    const fw = W - E - fx
    const body = 0.3125 * D - E
    pen.rect(fx, E, fw, body - E, { fill: FINISH, rx: 40 })
    pen.rect(fx + 30, E + 30, fw - 60, body - E - 110, { ...FAINT, rx: 25 })
    pen.line(fx + 22, body - 55, fx + fw - 22, body - 55, { sw: 0.5, op: 0.6 })
    pill(pen, 0.8125 * W + 45, body - 40, 30, 0.375 * D - body + 40 - E - 25)
    const sinkX = leg + 60
    pen.at(move(0, E), () => {
      sink(pen, sinkX, run - sinkX - 40, deep - E, { drainer: 'right' })
      divisions(pen, [sinkX - 30], 22, deep - E - 28)
    })
    const hobY = 0.66 * D
    pen.at(quarter(leg, 0), () => hob(pen, hobY, (leg - E) / 2))
    for (const y of [hobY - 300, hobY + 300]) pen.line(E + 22, y, leg - 28, y, FAINT)
    if (withWall) {
      wallCabinets(pen, E, run - E, [sinkX - 30], E)
      legWall(pen, E, E + 350, hobY, D - E)
    }
  }
}

function kitchenU(withWall) {
  return (pen, W, D) => {
    const top = 0.25 * D - E
    const legL = 0.25 * W - 40
    const legR = 0.75 * W + 40
    const fridgeY = D - E - 650
    pen.smooth(
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
      25,
      { fill: FINISH },
    )
    edgeLine(pen, E + 22, E + 22, W - E - 22, E + 22)
    edgeLine(pen, E + 22, E + 22, E + 22, fridgeY - 10)
    edgeLine(pen, W - E - 22, E + 22, W - E - 22, D - E - 22)
    edgeLine(pen, legL + 30, top - 28, legR - 30, top - 28)
    edgeLine(pen, legL - 28, top + 30, legL - 28, fridgeY - 30)
    edgeLine(pen, legR + 28, top + 30, legR + 28, D - E - 30)
    pen.line(E + 22, top, legL, top, FAINT)
    pen.line(legR, top, W - E - 22, top, FAINT)
    pen.at([0, 1, 1, 0, E, fridgeY + 5], () => fridgeTop(pen, 0, 0, 640, legL - E + 30, 'left'))
    const sinkX = W / 2 - 500
    pen.at(move(0, E), () => {
      sink(pen, sinkX, 1000, top - E, { bowls: 2, drainer: null })
      divisions(pen, [sinkX, sinkX + 1000, sinkX + 1600], 22, top - E - 28)
    })
    const hobY = 0.6 * D
    pen.at(quarter(W - E, 0), () => hob(pen, hobY, (W - E - legR) / 2))
    for (const y of [hobY - 300, hobY + 300]) pen.line(legR + 28, y, W - E - 22, y, FAINT)
    for (const y of [top + 600, top + 1200]) pen.line(E + 22, y, legL - 28, y, FAINT)
    if (withWall) {
      wallCabinets(pen, E, W - 2 * E, [sinkX, sinkX + 1000], E)
      pen.rect(E, E + 350, 350, fridgeY - E - 350, { sw: 0.5, dash: WALL_DASH, rx: 15 })
      pen.at([-1, 0, 0, 1, W, 0], () => legWall(pen, E, E + 350, hobY, D - E))
    }
  }
}

function counterStraight(pen, W, D) {
  worktop(pen, E, E, W - 2 * E, D - 2 * E)
  const n = Math.max(1, Math.round((W - 2 * E) / 600))
  const step = (W - 2 * E) / n
  divisions(
    pen,
    Array.from({ length: n - 1 }, (_, i) => E + step * (i + 1)),
    E + 22,
    D - E - 28,
  )
}

function counterL(pen, W, D) {
  const top = 0.5625 * D
  const leg = 0.3125 * W
  pen.smooth(
    [
      [E, E],
      [W - E, E],
      [W - E, top],
      [leg, top],
      [leg, D - E],
      [E, D - E],
    ],
    25,
    { fill: FINISH },
  )
  edgeLine(pen, E + 22, E + 22, W - E - 22, E + 22)
  edgeLine(pen, E + 22, E + 22, E + 22, D - E - 22)
  edgeLine(pen, leg + 30, top - 28, W - E - 30, top - 28)
  edgeLine(pen, leg - 28, top + 30, leg - 28, D - E - 30)
  pen.line(E + 22, top, leg - 28, top, FAINT)
  divisions(pen, [leg + 600, leg + 1200], E + 22, top - 28)
}

function kitchenSink(pen, W, D) {
  pen.at(move(0, E), () => {
    worktop(pen, E, 0, W - 2 * E, D - 2 * E)
    const sx = W / 2 - 600
    sink(pen, sx, 1200, D - 2 * E, { bowls: 2, drainer: 'right' })
    divisions(pen, [sx, sx + 1200], 22, D - 2 * E - 28)
  })
}

function stove(pen, W, D) {
  const front = D - 40
  pen.rect(E, E, W - 2 * E, front - E, { fill: FINISH, rx: 35 })
  pen.rect(E + 15, E + 12, W - 2 * E - 30, 70, { fill: FINISH, sw: 0.5, rx: 25 })
  for (let i = 0; i < 4; i++) knob(pen, E + 120 + i * ((W - 2 * E - 240) / 3), E + 47, 19)
  pen.rect(52, E + 105, W - 104, front - E - 140, { fill: GREY, rx: 40 })
  const cx = W / 2
  const cy = (E + 105 + front - 35) / 2
  for (const [dx, dy, r] of [
    [-165, -135, 100],
    [165, -140, 74],
    [-165, 140, 74],
    [165, 135, 92],
  ]) {
    pen.circle(cx + dx, cy + dy, r, { sw: 0.5 })
    pen.circle(cx + dx, cy + dy, r * 0.7, SOFT)
    pen.circle(cx + dx, cy + dy, r * 0.4, FAINT)
  }
  pill(pen, 110, front + 2, W - 220, 24)
}

function refrigerator(pen, W, D) {
  fridgeTop(pen, E, E, W - 2 * E, D - 2 * E + 4)
}

function dishwasher(pen, W, D) {
  const body = D - 40
  pen.rect(E, E, W - 2 * E, body - E, { fill: FINISH, rx: 35 })
  pen.rect(E + 22, E + 20, W - 2 * E - 44, 70, { fill: GREY, sw: 0.5, rx: 30 })
  for (let i = 0; i < 3; i++) pen.circle(E + 90 + i * 45, E + 55, 11, { fill: FINISH, sw: 0.5 })
  knob(pen, W - 95, E + 55, 20)
  pen.line(E + 22, body - 50, W - E - 22, body - 50, { sw: 0.5, op: 0.6 })
  const cy = (E + 100 + body - 50) / 2
  pen.circle(W / 2, cy, 170, { ...FAINT, dash: WALL_DASH })
  pen.circle(W / 2, cy, 28, { ...SOFT, dash: WALL_DASH })
  pill(pen, W / 2 - 160, body - 12, 320, 26)
}

function laundryUnit(pen, x, w, D, dryer) {
  const body = D - 110
  pen.rect(x, E, w, body - E, { fill: FINISH, rx: 45 })
  pen.rect(x + 22, E + 20, w - 44, 95, { fill: GREY, sw: 0.5, rx: 35 })
  if (!dryer) {
    pen.rect(x + 45, E + 38, 160, 60, { fill: FINISH, sw: 0.5, rx: 22 })
    pen.line(x + 98, E + 46, x + 98, E + 90, FAINT)
    pen.line(x + 152, E + 46, x + 152, E + 90, FAINT)
  } else {
    pen.rect(x + 45, E + 45, 120, 46, { fill: FINISH, sw: 0.5, rx: 18 })
  }
  pen.circle(x + w - 165, E + 68, 10, { fill: FINISH, sw: 0.5 })
  pen.circle(x + w - 135, E + 68, 10, { fill: FINISH, sw: 0.5 })
  knob(pen, x + w - 82, E + 68, 30)
  const cy = (E + 150 + body - 20) / 2
  const r = Math.min(w, body - E - 150) / 2 - 45
  pen.circle(x + w / 2, cy, r, { sw: 0.5, op: 0.55 })
  pen.circle(x + w / 2, cy, r * 0.72, { ...FAINT, dash: WALL_DASH })
  const door = Math.min(500, w - 140)
  pen.rect(x + w / 2 - door / 2, body - 12, door, 92, { fill: FINISH, rx: 46 })
  pen.rect(x + w / 2 - door / 2 + 35, body + 8, door - 70, 50, { fill: GREY, sw: 0.5, rx: 25 })
  pill(pen, x + w / 2 + door / 2 - 70, body + 68, 50, 20)
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
  for (const dx of [-150, 150]) {
    pen.rect(cx + dx - 11, E, 22, cy - 140 - E, { fill: GREY, sw: 0.5, rx: 11 })
  }
  pen.circle(cx, cy, r, { fill: FINISH })
  pen.circle(cx, cy, r - 40, SOFT)
  pen.circle(cx, cy, 72, { fill: GREY, sw: 0.5 })
  pen.circle(cx, cy, 45, SOFT)
  for (const dx of [-150, 150]) pen.circle(cx + dx, cy - 140, 28, { fill: GREY, sw: 0.5 })
  pen.rect(cx + r - 80, cy - 18, 80, 36, { fill: GREY, sw: 0.5, rx: 18 })
}

function hvac(pen, W, D) {
  pen.rect(E, E, W - 2 * E, D - 2 * E, { fill: FINISH, rx: 40 })
  const fx = D / 2
  const cy = D / 2
  const R = D / 2 - 55
  pen.circle(fx, cy, R, { fill: GREY })
  for (const k of [0.8, 0.6]) pen.circle(fx, cy, R * k, FAINT)
  for (let i = 0; i < 3; i++) {
    pen.at(mul(move(fx, cy), turn(i * 120)), () =>
      pen.path(
        [
          ['M', 0, -40],
          ['Q', R * 0.5, -R * 0.6, R * 0.85, -R * 0.12],
          ['Q', R * 0.45, R * 0.05, 0, 40],
          ['Z'],
        ],
        { fill: FINISH, sw: 0.5 },
      ),
    )
  }
  pen.circle(fx, cy, 45, { fill: DARK_GREY, sw: 0.5 })
  const gx = fx + R + 50
  pen.rect(gx, 55, W - E - 45 - gx, D - 110, { fill: FINISH, sw: 0.5, rx: 30 })
  for (let y = 95; y < D - 70; y += 36) pen.line(gx + 22, y, W - E - 67, y, SOFT)
  for (const dx of [0, 55]) pen.circle(W - E - 115 + dx, E + 28, 13, { fill: GREY, sw: 0.5 })
}

function barCounter(pen, x, W, D) {
  const back = D - 210
  pen.rect(x, back - 30, W, D - E - back + 30, { fill: FINISH, rx: 45 })
  pen.line(x + 40, D - E - 30, x + W - 40, D - E - 30, SOFT)
  pen.rect(x, E, W, back - E, { fill: FINISH, rx: 25 })
  pen.line(x + 22, E + 22, x + W - 22, E + 22, SOFT)
  const sx = x + W * 0.32
  const sy = (E + 22 + back) / 2 + 12
  pen.rect(sx - 190, sy - 150, 380, 300, { fill: GREY, rx: 70 })
  pen.rect(sx - 145, sy - 95, 290, 220, { fill: DARK_GREY, sw: 0.5, rx: 70 })
  drain(pen, sx, sy + 20, 20)
  tap(pen, sx, sy - 122, 110, 18)
  divisions(pen, [sx - 300, sx + 300, x + W * 0.66], E + 22, back)
}

function bar(pen, W, D) {
  barCounter(pen, E, W - 2 * E, D)
}

function stool(pen, x, y) {
  pen.circle(x, y, 205, FAINT)
  pen.circle(x, y, 178, { fill: FINISH })
  pen.circle(x, y, 140, SOFT)
}

function island(pen, x, y, w, d, stools, withSink, sinkW) {
  const seat = y + d + 115
  for (let i = 0; i < stools; i++) stool(pen, x + (w * (i + 0.5)) / stools, seat)
  pen.rect(x, y, w, d, { fill: FINISH, rx: 35 })
  pen.rect(x + 28, y + 28, w - 56, d - 56, { ...FAINT, rx: 20 })
  pen.line(x + 50, y + d - 300, x + w - 50, y + d - 300, { dash: WALL_DASH, op: 0.6 })
  if (withSink) {
    const cx = x + w / 2
    pen.rect(cx - sinkW / 2, y + 115, sinkW, 450, { fill: GREY, rx: 60 })
    const bowls = sinkW > 800 ? 2 : 1
    const each = (sinkW - 40) / bowls
    for (let i = 0; i < bowls; i++) {
      const bx = cx - sinkW / 2 + 20 + i * each
      pen.rect(bx + 15, y + 185, each - 30, 345, { fill: DARK_GREY, sw: 0.5, rx: 75 })
      drain(pen, bx + each / 2, y + 380, 22)
    }
    tap(pen, cx, y + 150, 150)
  }
}

const islandSymbol = (stools, withSink) => (pen, W, D) =>
  island(pen, E, E, W - 2 * E, D - E - 350, stools, withSink, stools > 2 ? 900 : 560)

function barIsland(pen, W, D) {
  barCounter(pen, E, W - 2 * E, 635)
  island(pen, 220, 1350, W - 440, 650, 3, false)
}

function toilet(pen, W, D) {
  const cx = W / 2
  pen.rect(cx - 120, 170, 240, 150, { fill: FINISH, rx: 50 })
  const cy = 475
  const b = D - cy - E
  pen.curve(egg(cx, cy, 190, b, 0.14), { fill: FINISH })
  pen.curve(egg(cx, cy + 8, 174, b - 22, 0.14), { fill: FINISH, sw: 0.5 })
  pen.curve(egg(cx, cy + 38, 112, b - 105, 0.12), { fill: GREY })
  pen.curve(egg(cx, cy + 52, 80, b - 150, 0.1), FAINT)
  for (const dx of [-110, 110]) pen.circle(cx + dx, 250, 14, { fill: GREY, sw: 0.5 })
  pen.rect(E, E, W - 2 * E, 185, { fill: FINISH, rx: 55 })
  pen.rect(cx - 170, E + 182, 340, 26, { fill: FINISH, sw: 0.5, rx: 13 })
  pen.circle(cx, E + 92, 34, { fill: GREY, sw: 0.5 })
  pen.line(cx, E + 60, cx, E + 124, { sw: 0.5 })
}

function vanity(basins) {
  return (pen, W, D) => {
    pen.rect(E, E, W - 2 * E, D - 2 * E, { fill: FINISH, rx: 30 })
    pen.line(E + 22, E + 25, W - E - 22, E + 25, SOFT)
    pen.line(E + 30, D - E - 28, W - E - 30, D - E - 28, SOFT)
    for (let i = 0; i < basins; i++) {
      const cx = (W * (i + 0.5)) / basins
      const cy = D * 0.57
      pen.ellipse(cx, cy, 225, 168, { fill: GREY })
      pen.ellipse(cx, cy + 12, 182, 128, { fill: DARK_GREY, sw: 0.5 })
      drain(pen, cx, cy + 22, 18)
      tap(pen, cx, E + 75, cy - 168 - E - 75 + 80, 24)
    }
  }
}

function bathtub(pen, W, D) {
  pen.rect(E, E, W - 2 * E, D - 2 * E, { fill: FINISH, rx: 30 })
  pen.curve(superellipse(W / 2, D / 2, W / 2 - 80, D / 2 - 80, 3.6), { fill: GREY })
  pen.curve(superellipse(W / 2 + 20, D / 2, W / 2 - 170, D / 2 - 150, 3), FAINT)
  drain(pen, 210, D / 2, 26)
  tap(pen, 210, 45, 85, 20)
}

function bathtubFree(pen, W, D) {
  pen.curve(superellipse(W / 2, D / 2, W / 2 - E, D / 2 - E, 2.6), { fill: FINISH })
  pen.curve(superellipse(W / 2, D / 2, W / 2 - 90, D / 2 - 85, 3), { fill: GREY })
  pen.curve(superellipse(W / 2, D / 2, W / 2 - 180, D / 2 - 160, 2.6), FAINT)
  drain(pen, W / 2, D / 2, 26)
  tap(pen, W / 2, 48, 100, 20)
}

function shower(cornerGlass) {
  return (pen, W, D) => {
    pen.rect(E, E, W - 2 * E, D - 2 * E, { fill: FINISH, rx: 30 })
    const i = 58
    pen.rect(i, i, W - 2 * i, D - 2 * i, { fill: GREY, sw: 0.5, rx: 75 })
    const cx = W / 2
    const cy = D / 2
    const k = 22
    for (const [x, y, sx, sy] of [
      [i, i, 1, 1],
      [W - i, i, -1, 1],
      [W - i, D - i, -1, -1],
      [i, D - i, 1, -1],
    ])
      pen.line(x + sx * k, y + sy * k, cx - sx * 50, cy - sy * 50, FAINT)
    pen.circle(cx, cy, 58, { fill: FINISH, sw: 0.5 })
    pen.circle(cx, cy, 40, SOFT)
    for (const d of [-16, 0, 16]) pen.line(cx - 22, cy + d, cx + 22, cy + d, FAINT)
    pen.rect(cx - 70, E + 8, 140, 34, { fill: GREY, sw: 0.5, rx: 17 })
    pen.circle(cx, E + 42 + 160, 115, { sw: 0.5, dash: WALL_DASH })
    const g = 12
    const gy = D - E - 30
    const split = cornerGlass ? W * 0.45 : W * 0.5
    pen.rect(E + 15, gy - g, split + 40 - E - 15, g, { fill: GREY, sw: 0.5, rx: 6 })
    pen.rect(split - 40, gy - 2 * g - 10, W - E - 15 - split + 40, g, {
      fill: GREY,
      sw: 0.5,
      rx: 6,
    })
    pill(pen, split + 10, gy - 2 * g - 40, 16, 34)
    if (cornerGlass)
      pen.rect(W - E - 30 - g, E + 15, g, D - 2 * E - 55, { fill: GREY, sw: 0.5, rx: 6 })
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
