import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = (path) => fileURLToPath(new URL(`../../../${path}`, import.meta.url))
const out = (path) => fileURLToPath(new URL(`../public/${path}`, import.meta.url))

function literal(file, start) {
  const text = readFileSync(root(file), 'utf8')
  const from = text.indexOf(start)
  if (from < 0) throw new Error(`${start} is not in ${file}`)
  let depth = 0
  let at = from + start.length
  do {
    if ('[{'.includes(text[at])) depth++
    if (']}'.includes(text[at])) depth--
    at++
  } while (depth > 0)
  return new Function(`return ${text.slice(from + start.length, at)}`)()
}

const FLOORS = literal('packages/core/src/catalog.ts', 'export const CATALOG_FLOOR_MATERIALS = ')
const FINISHES = literal('packages/core/src/catalog.ts', 'export const CATALOG_FINISHES = ')
const STYLES = literal('packages/core/src/catalog.ts', 'export const CATALOG_STYLES = ')
const COVERS = literal(
  'packages/scene/src/dressing.ts',
  'const COVERS: Record<string, { width: number; height: number }> = ',
)
const SPREAD = { width: 1500, height: 1500 }

function seeded(text) {
  let a = 2166136261
  for (const char of text) a = Math.imul(a ^ char.charCodeAt(0), 16777619)
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const f = (n) => String(Math.round(n * 10) / 10)
const between = (r, a, b) => a + (b - a) * r()
const pick = (r, list) => list[Math.floor(r() * list.length)]

const rgb = (hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
const hex = (c) =>
  `#${c
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
const mix = (a, b, t) => {
  const [x, y] = [rgb(a), rgb(b)]
  return hex(x.map((v, i) => v + (y[i] - v) * t))
}
const shade = (c, t) => (t > 0 ? mix(c, '#ffffff', t) : mix(c, '#000000', -t))
const vary = (c, r, amount) => {
  const [red, green, blue] = rgb(c)
  const light = (r() * 2 - 1) * amount * 255
  const warmth = (r() * 2 - 1) * amount * 0.35 * 255
  return hex([red + light + warmth, green + light, blue + light - warmth])
}

function smooth(points, closed = false) {
  const at = (i) =>
    closed
      ? points[(i + points.length) % points.length]
      : points[Math.max(0, Math.min(points.length - 1, i))]
  let d = `M${f(points[0][0])} ${f(points[0][1])}`
  const last = closed ? points.length : points.length - 1
  for (let i = 0; i < last; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`
  }
  return closed ? `${d}Z` : d
}

const rect = (x, y, w, h, fill, extra = '') =>
  `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fill}"${extra}/>`

function blob(r, cx, cy, size, corners = 6) {
  const turn = r() * Math.PI * 2
  return Array.from({ length: corners }, (_, i) => {
    const a = turn + (i / corners) * Math.PI * 2
    const reach = size * between(r, 0.55, 1)
    return [cx + Math.cos(a) * reach, cy + Math.sin(a) * reach]
  })
}

function chip(r, cx, cy, size, corners = 5) {
  const points = blob(r, cx, cy, size, corners).map(([x, y]) => [Math.round(x), Math.round(y)])
  return `M${points[0][0]} ${points[0][1]}${points
    .slice(1)
    .map(([x, y], i) => `l${x - points[i][0]} ${y - points[i][1]}`)
    .join('')
    .replace(/ -/g, '-')}z`
}

const polygon = (points) => `M${points.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`

function byColour(shapes) {
  const groups = new Map()
  for (const { colour, d } of shapes) groups.set(colour, `${groups.get(colour) ?? ''}${d}`)
  return [...groups].map(([colour, d]) => `<path fill="${colour}" d="${d}"/>`).join('')
}

function softGradients(id, dark, light) {
  return `<radialGradient id="${id}-dk"><stop offset="0" stop-color="${dark}" stop-opacity=".5"/><stop offset=".6" stop-color="${dark}" stop-opacity=".18"/><stop offset="1" stop-color="${dark}" stop-opacity="0"/></radialGradient><radialGradient id="${id}-lt"><stop offset="0" stop-color="${light}" stop-opacity=".5"/><stop offset=".6" stop-color="${light}" stop-opacity=".18"/><stop offset="1" stop-color="${light}" stop-opacity="0"/></radialGradient>`
}

function soft(id, W, H, r, { size, count, strength }) {
  let body = ''
  for (let i = 0; i < count; i++) {
    const cx = r() * W
    const cy = r() * H
    const rx = size * between(r, 0.4, 1.4)
    const ry = rx * between(r, 0.45, 1)
    const turn = between(r, 0, 180)
    const tone = r() < 0.5 ? 'dk' : 'lt'
    const alpha = Math.round(strength * between(r, 0.4, 1) * 100) / 100
    body += `<ellipse cx="0" cy="0" rx="${f(rx)}" ry="${f(ry)}" transform="translate(${f(cx)} ${f(cy)}) rotate(${f(turn)})" fill="url(#${id}-${tone})" opacity="${alpha}"/>`
  }
  return body
}

function specks(W, H, r, { count, size, colours }) {
  const shapes = []
  for (let i = 0; i < count; i++) {
    const s = size[0] + (size[1] - size[0]) * r() ** 2
    shapes.push({
      colour: pick(r, colours),
      d: chip(r, r() * W, r() * H, s, 4 + Math.floor(r() * 3)),
    })
  }
  return byColour(shapes)
}

function wood(_id, W, H, r, o) {
  const rows = Math.max(1, Math.round(H / o.plank))
  const ph = H / rows
  const grain = o.grain
  let planks = ''
  let lines = ''
  let joints = ''
  const shapes = []
  for (let row = 0; row < rows; row++) {
    const y0 = row * ph
    const count = o.joints === 0 ? 0 : r() < 0.35 ? 1 : 2
    const start = r() * W
    const cuts =
      count === 0
        ? [0, W]
        : Array.from(
            { length: count + 1 },
            (_, i) =>
              start + (i * W) / count + (i && i < count ? between(r, -W * 0.12, W * 0.12) : 0),
          )
    for (let k = 0; k < cuts.length - 1; k++) {
      const x0 = cuts[k]
      const x1 = cuts[k + 1]
      const len = x1 - x0
      const tone = vary(o.colour, r, o.vary)
      planks += rect(x0, y0, len, ph, tone)
      const stripes = Math.round((ph / o.gap) * 1.3)
      const drift = {
        a: (between(r, 0.02, 0.1) * ph * o.wave) / 2.5,
        l: between(r, 900, 2400),
        p: between(r, 0, 6.3),
      }
      const flame =
        r() < o.flame
          ? {
              at: between(r, x0 + len * 0.15, x1 - len * 0.15),
              reach: between(r, 180, 420),
              lift: between(r, 0.3, 0.7) * ph,
            }
          : null
      const steps = Math.max(4, Math.ceil(len / 45))
      for (let band = 0; band < 2; band++) {
        const by = between(r, y0 + ph * 0.15, y0 + ph * 0.85)
        lines += `<path d="M${f(x0)} ${f(by)}H${f(x1)}" stroke="${r() < 0.5 ? '#ffffff' : grain}" stroke-width="${f(between(r, 0.08, 0.22) * ph)}" stroke-opacity="${Math.round(between(r, 0.02, 0.05) * 100) / 100}"/>`
      }
      for (let s = 0; s < stripes; s++) {
        const base = between(r, y0 - ph * 0.15, y0 + ph * 1.15)
        const a2 = between(r, 0.2, 1) * o.wave
        const l2 = between(r, 150, 450)
        const p2 = between(r, 0, Math.PI * 2)
        const lift = flame ? flame.lift * (1 - Math.abs(base - y0 - ph * 0.6) / (ph * 1.2)) : 0
        const points = []
        for (let i = 0; i <= steps; i++) {
          const x = x0 + (len * i) / steps
          let y =
            base +
            drift.a * Math.sin((x / drift.l) * Math.PI * 2 + drift.p) +
            a2 * Math.sin((x / l2) * Math.PI * 2 + p2)
          if (flame) {
            const d = (x - flame.at) / flame.reach
            y -= lift * Math.exp(-d * d)
          }
          points.push([x, y])
        }
        const width = (r() < 0.15 ? between(r, 1.4, 2.6) : between(r, 0.35, 1)) * o.line
        const alpha = Math.round(between(r, 0.2, 1) * o.contrast * 100) / 100
        let run = []
        const flush = () => {
          if (run.length > 2)
            lines += `<path d="${smooth(run)}" fill="none" stroke="${grain}" stroke-width="${f(width)}" stroke-opacity="${alpha}"/>`
          run = []
        }
        for (const point of points) {
          if (point[1] > y0 + 1 && point[1] < y0 + ph - 1) run.push(point)
          else flush()
        }
        flush()
      }
      for (let n = 0; n < (len * ph * o.fleck) / 10000; n++) {
        const x = between(r, x0 + 4, x1 - 14)
        const y = between(r, y0 + 2, y0 + ph - 2)
        const l = between(r, 2, 10)
        shapes.push({
          colour: grain,
          d: `M${f(x)} ${f(y)}h${f(l)}v${f(between(r, 0.6, 1.4))}h${f(-l)}Z`,
        })
      }
      if (r() < o.knots) {
        const kx = between(r, x0 + 60, x1 - 60)
        const ky = between(r, y0 + ph * 0.3, y0 + ph * 0.7)
        const kr = between(r, 6, 14)
        lines += `<ellipse cx="${f(kx)}" cy="${f(ky)}" rx="${f(kr * 1.6)}" ry="${f(kr)}" fill="${shade(grain, -0.15)}" fill-opacity=".55"/><ellipse cx="${f(kx)}" cy="${f(ky)}" rx="${f(kr * 2.8)}" ry="${f(kr * 1.6)}" fill="none" stroke="${grain}" stroke-opacity=".35" stroke-width="1.2"/>`
      }
      if (count > 0)
        joints += `<path d="M${f(x0)} ${f(y0)}v${f(ph)}" stroke="${o.seam}" stroke-width="1.6" stroke-opacity=".55"/>`
    }
    if (o.seams !== false) {
      joints += `<path d="M0 ${f(y0)}H${f(W)}" stroke="${o.seam}" stroke-width="1.6" stroke-opacity=".5"/><path d="M0 ${f(y0 + 1.8)}H${f(W)}" stroke="#ffffff" stroke-width="1" stroke-opacity=".18"/>`
    }
  }
  return {
    back: o.colour,
    body: `${planks}<g fill-opacity="${o.contrast * 0.5}">${byColour(shapes)}</g>${lines}${joints}`,
  }
}

function boards(_id, W, H, r, o) {
  const count = Math.max(2, Math.round(W / o.board))
  const bw = W / count
  let body = ''
  for (let i = 0; i < count; i++) {
    const x = i * bw
    body += rect(x, 0, bw, H, vary(o.colour, r, o.vary))
    if (o.grain) {
      for (let s = 0; s < Math.round(bw / 9); s++) {
        const base = x + ((s + between(r, 0.2, 0.8)) / Math.round(bw / 9)) * bw
        const points = []
        const a = between(r, 1, 4)
        const l = between(r, 500, 1600)
        const p = between(r, 0, 6.3)
        for (let y = 0; y <= H + 0.01; y += H / 24) {
          points.push([
            Math.max(x + 2, Math.min(x + bw - 2, base + a * Math.sin((y / l) * 6.28 + p))),
            y,
          ])
        }
        body += `<path d="${smooth(points)}" fill="none" stroke="${o.grain}" stroke-width="${f(between(r, 0.5, 1.6))}" stroke-opacity="${Math.round(between(r, 0.15, 0.5) * o.contrast * 100) / 100}"/>`
      }
    }
    body += `<path d="M${f(x)} 0V${f(H)}" stroke="${o.seam}" stroke-width="5" stroke-opacity=".45"/><path d="M${f(x + 3.5)} 0V${f(H)}" stroke="#ffffff" stroke-width="2" stroke-opacity=".35"/><path d="M${f(x - 3.5)} 0V${f(H)}" stroke="#000000" stroke-width="2" stroke-opacity=".08"/>`
  }
  return { back: o.colour, body }
}

function grid(id, W, H, r, o) {
  const cols = Math.max(1, Math.round(W / o.width))
  let rows = Math.max(1, Math.round(H / o.height))
  if (o.bond === 'running' && rows % 2) rows += 1
  const tw = W / cols
  const th = H / rows
  const g = o.grout
  let tiles = ''
  let over = ''
  const shapes = []
  const defs = o.sheen
    ? `<linearGradient id="${id}-sh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="${o.sheen}"/><stop offset=".5" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="${o.sheen * 0.5}"/></linearGradient>`
    : ''
  for (let j = 0; j < rows; j++) {
    const shift = o.bond === 'running' ? (j % 2) * tw * 0.5 : 0
    for (let i = 0; i < cols; i++) {
      const x = i * tw + shift + g / 2
      const y = j * th + g / 2
      const w = tw - g
      const h = th - g
      const tone = vary(o.colour, r, o.vary)
      tiles += rect(x, y, w, h, tone, o.round ? ` rx="${o.round}"` : '')
      if (o.sheen) over += rect(x, y, w, h, `url(#${id}-sh)`, o.round ? ` rx="${o.round}"` : '')
      if (o.edge) {
        over += `<path d="M${f(x)} ${f(y + h - 1)}H${f(x + w)}M${f(x + w - 1)} ${f(y)}V${f(y + h)}" stroke="#000000" stroke-opacity="${o.edge}" stroke-width="2"/>`
        over += `<path d="M${f(x)} ${f(y + 1)}H${f(x + w)}M${f(x + 1)} ${f(y)}V${f(y + h)}" stroke="#ffffff" stroke-opacity="${o.edge * 0.8}" stroke-width="1.5"/>`
      }
      if (o.pits) {
        for (let n = 0; n < (w * h * o.pits) / 10000; n++) {
          shapes.push({
            colour: r() < 0.6 ? shade(tone, -0.18) : shade(tone, 0.12),
            d: polygon(
              blob(
                r,
                between(r, x + 3, x + w - 3),
                between(r, y + 3, y + h - 3),
                between(r, 0.6, 2.4),
                5,
              ),
            ),
          })
        }
      }
      if (o.streaks) {
        for (let n = 0; n < o.streaks; n++) {
          const sy = between(r, y + 4, y + h - 4)
          const points = []
          for (let t = 0; t <= 6; t++)
            points.push([
              x + 2 + ((w - 4) * t) / 6,
              Math.max(y + 2, Math.min(y + h - 2, sy + between(r, -h * 0.015, h * 0.015))),
            ])
          over += `<path d="${smooth(points)}" fill="none" stroke="${r() < 0.5 ? shade(tone, -0.12) : shade(tone, 0.1)}" stroke-width="${f(between(r, 2, 9))}" stroke-opacity=".18"/>`
        }
      }
    }
  }
  return { back: o.groutColour, defs, body: `${tiles}${byColour(shapes)}${over}` }
}

function hexagons(_id, W, H, r, o) {
  const n = Math.max(2, 2 * Math.round(W / (1.5 * o.radius) / 2))
  const R = W / (1.5 * n)
  const m = Math.max(1, Math.round(H / (Math.sqrt(3) * R)))
  const sy = H / (m * Math.sqrt(3) * R)
  const inner = R - o.grout / Math.sqrt(3)
  let body = ''
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      const cx = i * 1.5 * R
      const cy = (j + (i % 2) * 0.5) * Math.sqrt(3) * R * sy
      const corners = Array.from({ length: 6 }, (_, k) => [
        cx + inner * Math.cos((k * Math.PI) / 3),
        cy + inner * Math.sin((k * Math.PI) / 3) * sy,
      ])
      body += `<path d="${polygon(corners)}" fill="${vary(o.colour, r, o.vary)}"/>`
      body += `<path d="M${f(corners[3][0] + 3)} ${f(corners[3][1])}L${f(corners[4][0] + 2)} ${f(corners[4][1] + 2)}L${f(corners[5][0] - 2)} ${f(corners[5][1] + 2)}" fill="none" stroke="#ffffff" stroke-opacity=".5" stroke-width="2"/>`
    }
  }
  return { back: o.groutColour, body }
}

function herringbone(_id, W, H, r, o) {
  const k = o.ratio
  const nx = Math.max(1, Math.round(W / (Math.SQRT2 * o.width)))
  const w = W / (nx * Math.SQRT2)
  const ny = Math.max(1, Math.round(H / (k * Math.SQRT2 * w)))
  const sy = H / (ny * k * Math.SQRT2 * w)
  const g = o.grout / 2
  const turn = (x, y) => [((x + y) / Math.SQRT2) * w, ((y - x) / Math.SQRT2) * w * sy]
  const piece = (x0, y0, x1, y1) =>
    [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ].map(([x, y]) => turn(x, y))
  const inset = g / w
  let body = ''
  const reach = Math.ceil((W + H) / w) + 4 * k
  for (let s = -reach; s <= reach; s++) {
    for (let t = -reach; t <= reach; t++) {
      const ox = -k * s
      const oy = k * s
      const shapes = [
        [t + ox + inset, t + oy + inset, t + k + ox - inset, t + 1 + oy - inset],
        [t + k + ox + inset, t - k + 1 + oy + inset, t + k + 1 + ox - inset, t + 1 + oy - inset],
      ]
      for (const [x0, y0, x1, y1] of shapes) {
        const corners = piece(x0, y0, x1, y1)
        const xs = corners.map((c) => c[0])
        const ys = corners.map((c) => c[1])
        if (
          Math.max(...xs) < 0 ||
          Math.min(...xs) > W ||
          Math.max(...ys) < 0 ||
          Math.min(...ys) > H
        )
          continue
        body += `<path d="${polygon(corners)}" fill="${vary(o.colour, r, o.vary)}"/>`
      }
    }
  }
  return { back: o.groutColour, body }
}

function scales(id, W, H, r, o) {
  const across = Math.max(1, Math.round(W / (2 * o.radius)))
  const R = W / (2 * across)
  const rows = 2 * Math.max(1, Math.round(H / (2 * R)))
  const ry = H / rows
  let body = ''
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < across; i++) {
      const cx = i * 2 * R + (j % 2) * R
      const cy = j * ry
      const tone = vary(o.colour, r, o.vary)
      body += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(R - o.grout / 2)}" ry="${f((R - o.grout / 2) * (ry / R))}" fill="${tone}" stroke="${o.groutColour}" stroke-width="${o.grout}"/>`
      body += `<ellipse cx="${f(cx)}" cy="${f(cy - ry * 0.25)}" rx="${f(R * 0.8)}" ry="${f(ry * 0.65)}" fill="url(#${id}-gl)"/>`
    }
  }
  return {
    back: o.groutColour,
    defs: `<radialGradient id="${id}-gl" cy=".3"><stop offset="0" stop-color="#ffffff" stop-opacity=".22"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>`,
    body,
  }
}

function vein(r, W, H, o, from) {
  let [x, y] = from ?? [r() * W, r() * H]
  let angle = o.angle + between(r, -0.5, 0.5)
  const points = [[x, y]]
  const steps = Math.round(between(r, o.length[0], o.length[1]) / o.step)
  for (let i = 0; i < steps; i++) {
    angle += between(r, -o.wander, o.wander)
    angle += (o.angle - angle) * 0.08
    x += Math.cos(angle) * o.step
    y += Math.sin(angle) * o.step
    if (x < -0.45 * W || x > 1.45 * W || y < -0.45 * H || y > 1.45 * H) break
    points.push([x, y])
  }
  return points
}

function ribbon(points, width, r) {
  if (points.length < 3) return ''
  const left = []
  const right = []
  const phase = r() * 6.3
  points.forEach(([x, y], i) => {
    const [px, py] = points[Math.max(0, i - 1)]
    const [nx, ny] = points[Math.min(points.length - 1, i + 1)]
    const len = Math.hypot(nx - px, ny - py) || 1
    const t = i / (points.length - 1)
    const w = (width * Math.sin(Math.PI * t) ** 0.6 * (0.55 + 0.45 * Math.sin(i * 0.7 + phase))) / 2
    left.push([x - ((ny - py) / len) * w, y + ((nx - px) / len) * w])
    right.push([x + ((ny - py) / len) * w, y - ((nx - px) / len) * w])
  })
  return smooth([...left, ...right.reverse()], true)
}

function marble(id, W, H, r, o) {
  let body = soft(id, W, H, r, {
    size: o.cloud,
    count: Math.round((W * H) / (o.cloud * o.cloud)) * 2,
    strength: o.mist,
  })
  for (let v = 0; v < Math.round((W * H * o.veins) / 1e6); v++) {
    const path = vein(r, W, H, o)
    const width = between(r, o.width[0], o.width[1])
    const colour = pick(r, o.colours)
    body += `<path d="${ribbon(path, width * 5, r)}" fill="${colour}" fill-opacity="${o.halo}"/>`
    body += `<path d="${ribbon(path, width * 2.2, r)}" fill="${colour}" fill-opacity="${o.halo * 1.8}"/>`
    body += `<path d="${ribbon(path, width, r)}" fill="${colour}" fill-opacity="${o.core}"/>`
    for (let b = 0; b < o.branches; b++) {
      const twig = vein(
        r,
        W,
        H,
        {
          ...o,
          angle: o.angle + between(r, -1.2, 1.2),
          length: [o.length[0] * 0.15, o.length[1] * 0.35],
        },
        pick(r, path),
      )
      body += `<path d="${ribbon(twig, width * 0.45, r)}" fill="${colour}" fill-opacity="${o.core * 0.7}"/>`
    }
  }
  if (o.slabs) body += slabJoints(W, H, o.slabs, o.joint)
  return { back: o.colour, defs: softGradients(id, o.dark, o.light), body }
}

function slabJoints(W, H, [cols, rows], colour) {
  let d = ''
  for (let i = 0; i < cols; i++) d += `M${f((i * W) / cols)} 0V${f(H)}`
  for (let j = 0; j < rows; j++) d += `M0 ${f((j * H) / rows)}H${f(W)}`
  return `<path d="${d}" stroke="${colour}" stroke-width="2.5" stroke-opacity=".6"/>`
}

function stone(id, W, H, r, o) {
  let body = ''
  if (o.slabs) {
    const [cols, rows] = o.slabs
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++)
        body += rect(
          (i * W) / cols,
          (j * H) / rows,
          W / cols,
          H / rows,
          vary(o.colour, r, o.vary ?? 0.02),
        )
    }
  }
  body += soft(id, W, H, r, {
    size: o.cloud,
    count: Math.round(((W * H) / (o.cloud * o.cloud)) * 2.5),
    strength: o.mist,
  })
  if (o.fine)
    body += soft(id, W, H, r, {
      size: o.fine,
      count: Math.round(((W * H) / (o.fine * o.fine)) * 0.8),
      strength: o.mist * 0.8,
    })
  if (o.grains)
    body += specks(W, H, r, { ...o.grains, count: Math.round((W * H * o.grains.density) / 1e6) })
  if (o.specks)
    body += specks(W, H, r, { ...o.specks, count: Math.round((W * H * o.specks.density) / 1e6) })
  if (o.veins) {
    for (let v = 0; v < Math.round((W * H * o.veins.count) / 1e6); v++) {
      const path = vein(r, W, H, o.veins)
      body += `<path d="${ribbon(path, between(r, o.veins.width[0], o.veins.width[1]), r)}" fill="${pick(r, o.veins.colours)}" fill-opacity="${o.veins.core}"/>`
    }
  }
  if (o.slabs) body += slabJoints(W, H, o.slabs, o.joint)
  return { back: o.colour, defs: softGradients(id, o.dark, o.light), body }
}

function metal(id, W, H, r, o) {
  const defs = `<linearGradient id="${id}-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(o.colour, -o.sweep)}"/><stop offset=".3" stop-color="${shade(o.colour, o.sweep * 0.8)}"/><stop offset=".55" stop-color="${o.colour}"/><stop offset=".8" stop-color="${shade(o.colour, o.sweep * 0.5)}"/><stop offset="1" stop-color="${shade(o.colour, -o.sweep)}"/></linearGradient>`
  const lines = []
  for (let i = 0; i < (H * o.lines) / 100; i++) {
    const y = r() * H
    const light = r() < 0.5
    lines.push(
      `<path d="M0 ${f(y)}H${W}" stroke="${light ? '#ffffff' : '#000000'}" stroke-width="${f(between(r, 0.6, 3.5))}" stroke-opacity="${Math.round(between(r, 0.03, light ? 0.16 : 0.1) * 100) / 100}"/>`,
    )
  }
  const short = []
  for (let i = 0; i < (W * H) / 25000; i++) {
    const x = r() * W
    const y = r() * H
    short.push(`M${f(x)} ${f(y)}h${f(between(r, 40, 260))}`)
  }
  return {
    back: `url(#${id}-g)`,
    defs,
    body: `${lines.join('')}<path d="${short.join('')}" stroke="#ffffff" stroke-opacity=".12" stroke-width="1"/>`,
  }
}

function terrazzo(id, W, H, r, o) {
  const chips = []
  const count = Math.round((W * H * o.density) / 1e6)
  for (let i = 0; i < count; i++) {
    const big = r() < 0.12
    const s = big ? between(r, o.size[1] * 0.6, o.size[1]) : between(r, o.size[0], o.size[1] * 0.45)
    chips.push({
      colour: vary(pick(r, o.chips), r, 0.04),
      d: chip(r, r() * W, r() * H, s, big ? 7 : 5),
    })
  }
  return {
    back: o.colour,
    defs: softGradients(id, o.dark, o.light),
    body: `${soft(id, W, H, r, { size: 260, count: Math.round((W * H) / 40000), strength: 0.25 })}${byColour(chips)}`,
  }
}

const WOOD = {
  plank: 192,
  gap: 7,
  wave: 2.5,
  line: 1,
  vary: 0.05,
  fleck: 0,
  knots: 0,
  flame: 0.35,
}

const LOOKS = {
  ash: {
    kind: wood,
    ...WOOD,
    colour: '#dfbd96',
    grain: '#9a6c42',
    seam: '#6f4f33',
    contrast: 0.5,
    flame: 0.5,
    vary: 0.04,
  },
  birch: {
    kind: wood,
    ...WOOD,
    colour: '#e2d2b9',
    grain: '#b59a76',
    seam: '#8e7a60',
    contrast: 0.35,
    gap: 9,
    wave: 1.5,
    fleck: 1.2,
    flame: 0.15,
    vary: 0.035,
  },
  'red-oak': {
    kind: wood,
    ...WOOD,
    colour: '#d3a473',
    grain: '#93573a',
    seam: '#6e4429',
    contrast: 0.5,
    knots: 0.12,
    flame: 0.55,
    vary: 0.035,
  },
  'natural-oak': {
    kind: wood,
    ...WOOD,
    colour: '#d0a87f',
    grain: '#8a6340',
    seam: '#654a31',
    contrast: 0.5,
    knots: 0.2,
    flame: 0.5,
    vary: 0.04,
  },
  beech: {
    kind: wood,
    ...WOOD,
    colour: '#d3b28a',
    grain: '#a87e57',
    seam: '#7a5c40',
    contrast: 0.35,
    gap: 8,
    wave: 1.2,
    fleck: 3,
    flame: 0.1,
    vary: 0.04,
  },
  'white-oak': {
    kind: wood,
    ...WOOD,
    colour: '#e8dac6',
    grain: '#ad9476',
    seam: '#8b7862',
    contrast: 0.45,
    knots: 0.06,
    flame: 0.45,
    vary: 0.035,
  },
  'brick-beige': {
    kind: grid,
    width: 225,
    height: 107,
    bond: 'stack',
    colour: '#c9b9ab',
    groutColour: '#ddd5cb',
    grout: 10,
    vary: 0.06,
    pits: 1.2,
    edge: 0.12,
  },
  'brick-red': {
    kind: grid,
    width: 225,
    height: 100,
    bond: 'running',
    colour: '#ae7a62',
    groutColour: '#c9bcae',
    grout: 10,
    vary: 0.08,
    pits: 1.5,
    edge: 0.15,
  },
  'brick-grey': {
    kind: grid,
    width: 225,
    height: 110,
    bond: 'running',
    colour: '#a29a93',
    groutColour: '#c4beb6',
    grout: 10,
    vary: 0.07,
    pits: 1.5,
    edge: 0.15,
  },
  'tile-blue': {
    kind: grid,
    width: 200,
    height: 200,
    colour: '#b9cee3',
    groutColour: '#e9eef2',
    grout: 3,
    vary: 0.03,
    sheen: 0.07,
    edge: 0.05,
  },
  'tile-beige': {
    kind: grid,
    width: 512,
    height: 512,
    colour: '#eeebe5',
    groutColour: '#d6d0c6',
    grout: 3,
    vary: 0.015,
    sheen: 0.05,
    pits: 0.15,
  },
  'tile-white': {
    kind: grid,
    width: 256,
    height: 256,
    colour: '#f2f2f0',
    groutColour: '#d9d9d5',
    grout: 3,
    vary: 0.012,
    sheen: 0.06,
    edge: 0.04,
  },
  'tile-seafoam': {
    kind: grid,
    width: 128,
    height: 128,
    colour: '#a5b6b3',
    groutColour: '#dfe3df',
    grout: 3,
    vary: 0.06,
    sheen: 0.1,
    edge: 0.06,
    round: 2,
  },
  'tile-slate': {
    kind: grid,
    width: 380,
    height: 198,
    bond: 'running',
    colour: '#9fa9a2',
    groutColour: '#c8ccc6',
    grout: 4,
    vary: 0.05,
    streaks: 3,
    pits: 0.6,
  },
  'tile-hex-mint': {
    kind: hexagons,
    radius: 89,
    colour: '#e3eee3',
    groutColour: '#ccd5cc',
    grout: 3,
    vary: 0.02,
  },
  'tile-herringbone': {
    kind: herringbone,
    width: 94,
    ratio: 3,
    colour: '#f6f3ec',
    groutColour: '#dcd7cd',
    grout: 3,
    vary: 0.015,
  },
  'tile-terracotta': {
    kind: scales,
    radius: 100,
    colour: '#d6a283',
    groutColour: '#efe3d5',
    grout: 5,
    vary: 0.06,
  },
  calacatta: {
    kind: marble,
    colour: '#f3f1ef',
    dark: '#c9c2bb',
    light: '#ffffff',
    cloud: 260,
    mist: 0.35,
    veins: 2.6,
    angle: 0.55,
    wander: 0.18,
    step: 40,
    length: [900, 2400],
    width: [8, 24],
    colours: ['#8d8378', '#a28c6a', '#7d7670'],
    halo: 0.06,
    core: 0.55,
    branches: 2,
  },
  'marble-white': {
    kind: marble,
    colour: '#fafafa',
    dark: '#d6d6d8',
    light: '#ffffff',
    cloud: 200,
    mist: 0.3,
    veins: 7,
    angle: -0.6,
    wander: 0.22,
    step: 30,
    length: [400, 1200],
    width: [1.5, 6],
    colours: ['#9fa1a6', '#b9babe', '#c8c9cc'],
    halo: 0.05,
    core: 0.45,
    branches: 1,
    slabs: [2, 2],
    joint: '#dcdcdc',
  },
  'marble-beige': {
    kind: marble,
    colour: '#e8dbca',
    dark: '#c9b39a',
    light: '#f6eee4',
    cloud: 140,
    mist: 0.45,
    veins: 12,
    angle: 0.4,
    wander: 0.28,
    step: 22,
    length: [250, 800],
    width: [1.5, 7],
    colours: ['#b0957a', '#f8f3ec', '#9e8369', '#c4ab90'],
    halo: 0.07,
    core: 0.5,
    branches: 1,
    slabs: [2, 2],
    joint: '#cdbba6',
  },
  soapstone: {
    kind: marble,
    colour: '#64625f',
    dark: '#3f3e3c',
    light: '#8a8884',
    cloud: 180,
    mist: 0.5,
    veins: 3,
    angle: 0.2,
    wander: 0.35,
    step: 30,
    length: [300, 900],
    width: [1.5, 4],
    colours: ['#9a9893', '#b3b1ab'],
    halo: 0.05,
    core: 0.35,
    branches: 1,
  },
  granite: {
    kind: stone,
    colour: '#a3a29e',
    dark: '#6b6a67',
    light: '#d0cfca',
    cloud: 120,
    mist: 0.12,
    slabs: [2, 2],
    joint: '#7d7c78',
    vary: 0.015,
    grains: { density: 5000, size: [3, 7], colours: ['#96948f', '#aeaca7', '#8a8884', '#b8b2ab'] },
    specks: {
      density: 11000,
      size: [1.5, 5],
      colours: ['#2f2f31', '#3d3d40', '#57575a', '#e7e6e2', '#d5d2cc', '#c2b4aa', '#77736e'],
    },
  },
  limestone: {
    kind: stone,
    colour: '#ebe4dc',
    dark: '#cdbfae',
    light: '#f8f4ee',
    cloud: 160,
    fine: 45,
    mist: 0.4,
    slabs: [2, 2],
    joint: '#d0c6ba',
    vary: 0.02,
    specks: { density: 350, size: [0.8, 2.5], colours: ['#cbbca9', '#d8ccbc', '#f7f3ed'] },
  },
  'concrete-light': {
    kind: stone,
    colour: '#dcdbd7',
    dark: '#b7b5af',
    light: '#f2f1ee',
    cloud: 220,
    fine: 60,
    mist: 0.3,
    specks: { density: 450, size: [0.6, 2.2], colours: ['#a9a7a1', '#bdbbb5', '#efeeea'] },
  },
  'concrete-dark': {
    kind: stone,
    colour: '#bdbdbc',
    dark: '#8d8d8b',
    light: '#d6d6d4',
    cloud: 200,
    fine: 55,
    mist: 0.35,
    specks: { density: 600, size: [0.6, 2.4], colours: ['#8a8a88', '#9d9d9b', '#d2d2d0'] },
  },
  'terrazzo-stone': {
    kind: terrazzo,
    colour: '#e3e2e0',
    dark: '#c4c2be',
    light: '#f4f3f1',
    density: 2600,
    size: [2, 14],
    chips: ['#b9b6b1', '#8f8c87', '#f7f6f3', '#cfc8bd', '#5f5d5a', '#c7b29a', '#a9aaa8'],
  },
}

const VENEER = {
  kind: wood,
  ...WOOD,
  joints: 0,
  seams: false,
  plank: 230,
  gap: 6,
  contrast: 0.5,
  flame: 0.5,
  vary: 0.02,
}

const FINISH_LOOKS = {
  'oak-dark': { ...VENEER, colour: '#6e4b31', grain: '#3c2717', seam: '#2c1c10' },
  'oak-medium': { ...VENEER, colour: '#a97b4f', grain: '#6c4a2c', seam: '#4f361f' },
  'oak-light': { ...VENEER, colour: '#d6b68b', grain: '#9a7550', seam: '#7a5b3e' },
  'ash-light': { ...VENEER, colour: '#e8d6b8', grain: '#b0916a', seam: '#8e7353', contrast: 0.45 },
  'ash-natural': { ...VENEER, colour: '#d8b98f', grain: '#9a7149', seam: '#73543a' },
  acorn: { ...VENEER, colour: '#bf8c4f', grain: '#7e5328', seam: '#5c3c1c' },
  walnut: { ...VENEER, colour: '#5f3f2b', grain: '#2f1d12', seam: '#24160d', contrast: 0.65 },
  maple: {
    ...VENEER,
    colour: '#ead2a8',
    grain: '#c19e72',
    seam: '#9b7d58',
    contrast: 0.35,
    flame: 0.2,
  },
  cherry: { ...VENEER, colour: '#9c5a3a', grain: '#5e301b', seam: '#45230f' },
  'oak-paneling': {
    kind: boards,
    board: 150,
    colour: '#c69c6d',
    grain: '#8a6440',
    seam: '#5e4329',
    contrast: 0.8,
    vary: 0.05,
  },
  'white-wood-paneling': {
    kind: boards,
    board: 150,
    colour: '#f3f1eb',
    seam: '#bdb8ad',
    vary: 0.01,
  },
  'metal-steel': { kind: metal, colour: '#c3c7cb', sweep: 0.05, lines: 18 },
  'metal-zinc': { kind: metal, colour: '#9ea4a7', sweep: 0.04, lines: 14 },
  'metal-bronze': { kind: metal, colour: '#8f6b45', sweep: 0.06, lines: 16 },
  'metal-gold': { kind: metal, colour: '#c8a25a', sweep: 0.06, lines: 16 },
  'concrete-light': { ...LOOKS['concrete-light'], cloud: 400, fine: 160, mist: 0.25 },
  'concrete-dark': { ...LOOKS['concrete-dark'], cloud: 400, fine: 160, mist: 0.3 },
  terrazzo: { ...LOOKS['terrazzo-stone'], density: 1400, size: [4, 18] },
  granite: {
    ...LOOKS.granite,
    slabs: undefined,
    grains: { ...LOOKS.granite.grains, density: 1200, size: [4, 9] },
    specks: { ...LOOKS.granite.specks, density: 3500, size: [2, 6] },
  },
  'brick-beige': { ...LOOKS['brick-beige'], width: 240, height: 80 },
  'brick-red': { ...LOOKS['brick-red'], width: 240, height: 80 },
  'brick-grey': { ...LOOKS['brick-grey'], width: 240, height: 80 },
}

const lookOf = (id) => FINISH_LOOKS[id] ?? LOOKS[id]

function periodic(id, W, H, look) {
  const r = seeded(`${id}:${W}x${H}`)
  const art = look.kind(id, W, H, r, look)
  const uses = [-H, 0, H]
    .flatMap((dy) => [-W, 0, W].map((dx) => `<use href="#${id}-t" x="${dx}" y="${dy}"/>`))
    .join('')
  return {
    defs: `${art.defs ?? ''}<g id="${id}-t">${art.body}</g>`,
    content: `<rect width="${W}" height="${H}" fill="${art.back}"/>${uses}`,
  }
}

function file(W, H, long, drawn) {
  const scale = long / Math.max(W, H)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(W * scale)}" height="${Math.round(H * scale)}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs>${drawn.defs}</defs>${drawn.content}</svg>\n`
}

function write(path, text) {
  mkdirSync(out(path).replace(/\/[^/]+$/, ''), { recursive: true })
  writeFileSync(out(path), text)
  console.log(`${path}  ${Math.round(text.length / 1024)} kB`)
}

for (const material of FLOORS) {
  const look = LOOKS[material.id]
  if (!look) throw new Error(`${material.id} has no look`)
  const { width, depth } = material.unit
  write(
    `textures/${material.texture}`,
    file(width, depth, 1024, periodic(material.id, width, depth, look)),
  )
}

const coverOf = (finish) => COVERS[finish.category] ?? SPREAD

function veneer(id, cover, look) {
  if (look.kind !== wood) return periodic(id, cover.width, cover.height, look)
  const turned = periodic(id, cover.height, cover.width, look)
  return { defs: turned.defs, content: `<g transform="matrix(0 1 1 0 0 0)">${turned.content}</g>` }
}

for (const finish of FINISHES) {
  if (!finish.picture) continue
  const look = lookOf(finish.id)
  if (!look) throw new Error(`${finish.id} has no look`)
  const cover = coverOf(finish)
  write(finish.picture, file(cover.width, cover.height, 1024, veneer(finish.id, cover, look)))
}

const S = 0.07
const C30 = Math.cos(Math.PI / 6)
const CARD = 512
const B = { x: 256, y: 276 }
const WALL = 2600
const SLAB = 250
const REACH = 6000
const exact = (matrix) => matrix.map((n) => String(Math.round(n * 1e5) / 1e5)).join(' ')
const at = (a, b, z) => [B.x + (a - b) * S * C30, B.y + (a + b) * S * 0.5 - z * S]
const onRight = (u, down) => at(u, 0, WALL - down)
const onLeft = (u, down) => at(0, u, WALL - down)
const RIGHT = [S * C30, S * 0.5, 0, S, ...at(0, 0, WALL)]
const LEFT = [-S * C30, S * 0.5, 0, S, ...at(0, 0, WALL)]
const FLAT = (z) => [S * C30, S * 0.5, -S * C30, S * 0.5, ...at(0, 0, z)]

const drawnOnce = new Set()

function patterned(id, drawn, width, height, matrix) {
  const shared = drawnOnce.has(drawn.defs) ? '' : drawn.defs
  drawnOnce.add(drawn.defs)
  return {
    defs: `${shared}<pattern id="${id}" patternUnits="userSpaceOnUse" width="${width}" height="${height}" patternTransform="matrix(${exact(matrix)})">${drawn.content}</pattern>`,
    fill: `url(#${id})`,
  }
}

function worn(id, finishId, matrix, upright = false) {
  const finish = FINISHES.find((each) => each.id === finishId)
  if (!finish?.picture) {
    const colour = finish?.colour ?? finishId
    return {
      defs: '',
      fill: colour === '#ffffff' ? '#f8f7f4' : colour === '#000000' ? '#26262a' : colour,
    }
  }
  const cover = coverOf(finish)
  const look = lookOf(finishId)
  const drawn = upright
    ? veneer(finishId, cover, look)
    : periodic(finishId, cover.width, cover.height, look)
  return patterned(id, drawn, cover.width, cover.height, matrix)
}

function laid(id, materialId, matrix) {
  const material = FLOORS.find((each) => each.id === materialId)
  const { width, depth } = material.unit
  return patterned(
    id,
    periodic(`floor-${materialId}`, width, depth, LOOKS[materialId]),
    width,
    depth,
    matrix,
  )
}

const face = (points, fill, extra = '') => `<path d="${polygon(points)}" fill="${fill}"${extra}/>`
const onWall = (side, u0, u1, d0, d1) => [side(u0, d0), side(u1, d0), side(u1, d1), side(u0, d1)]

function card(style) {
  drawnOnce.clear()
  const d = style.defaults
  const floor = laid('fl', d.floor, FLAT(0))
  const right = worn('wr', d.walls, RIGHT)
  const left = worn('wl', d.walls, LEFT)
  const ceiling = worn('ce', d.ceiling, FLAT(WALL + SLAB))
  const door = worn('dr', d.doors, LEFT, true)
  const frame = worn('wn', d.windows, RIGHT, true)
  const defs = [floor, right, left, ceiling, door, frame].map((each) => each.defs)
  defs.push(
    '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c4dbec"/><stop offset="1" stop-color="#eaf2f5"/></linearGradient>',
    '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ebe8e3"/><stop offset="1" stop-color="#e2ded7"/></linearGradient>',
    `<linearGradient id="fs" gradientUnits="userSpaceOnUse" x1="0" y1="${B.y}" x2="0" y2="${B.y + 120}"><stop offset="0" stop-color="#000000" stop-opacity=".14"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></linearGradient>`,
  )

  let art = `<rect width="${CARD}" height="${CARD}" fill="url(#bg)"/>`
  const ground = [at(0, 0, 0), at(REACH, 0, 0), at(REACH, REACH, 0), at(0, REACH, 0)]
  art += face(ground, floor.fill) + face(ground, 'url(#fs)')
  const leftWall = onWall(onLeft, 0, REACH, 0, WALL)
  const rightWall = onWall(onRight, 0, REACH, 0, WALL)
  art += face(leftWall, left.fill) + face(leftWall, '#000000', ' fill-opacity=".08"')
  art += face(rightWall, right.fill)
  art += `<path d="M${f(B.x)} ${f(B.y)}V${f(B.y - WALL * S)}" stroke="#000000" stroke-opacity=".1"/>`
  art += face(onWall(onLeft, 0, REACH, WALL - 90, WALL), '#ebe9e4')
  art += face(onWall(onRight, 0, REACH, WALL - 90, WALL), '#f5f4f1')

  const [d0, d1, head, casing] = [1000, 1900, 2100, 70]
  art += face(onWall(onLeft, d0 - casing, d1 + casing, WALL - head - casing, WALL), door.fill)
  art += face(
    onWall(onLeft, d0 - casing, d1 + casing, WALL - head - casing, WALL),
    '#000000',
    ' fill-opacity=".12"',
  )
  art += face(onWall(onLeft, d0, d1, WALL - head, WALL), door.fill)
  art += face(
    onWall(onLeft, d0, d1, WALL - head, WALL),
    '#000000',
    ' fill-opacity=".04" stroke="#000000" stroke-opacity=".25" stroke-width=".8"',
  )
  for (const [top, bottom] of [
    [WALL - head + 130, WALL - head + 950],
    [WALL - head + 1100, WALL - 150],
  ]) {
    art += face(
      onWall(onLeft, d0 + 130, d1 - 130, top, bottom),
      'none',
      ' stroke="#000000" stroke-opacity=".16" stroke-width=".8"',
    )
  }
  const [hx, hy] = onLeft(d1 - 100, WALL - 1050)
  art += `<path d="M${f(hx)} ${f(hy)}l${f(-110 * S * C30)} ${f(110 * S * 0.5)}" stroke="#2a2a2a" stroke-width="2" stroke-linecap="round"/>`

  const [w0, w1, sill, top, band] = [800, 2600, 900, 2200, 60]
  art += face(onWall(onRight, w0, w1, WALL - top, WALL - sill), frame.fill)
  art += face(
    onWall(onRight, w0, w1, WALL - top, WALL - sill),
    '#000000',
    ' fill-opacity=".06" stroke="#000000" stroke-opacity=".22" stroke-width=".8"',
  )
  const middle = (w0 + w1) / 2
  for (const [a, b] of [
    [w0 + band, middle - band / 2],
    [middle + band / 2, w1 - band],
  ]) {
    art += face(onWall(onRight, a, b, WALL - top + band, WALL - sill - band), 'url(#sky)')
    const span = b - a
    art += face(
      [
        onRight(a + span * 0.3, WALL - top + band),
        onRight(a + span * 0.48, WALL - top + band),
        onRight(a + span * 0.12, WALL - sill - band),
        onRight(a - span * 0.06 + span * 0.0, WALL - sill - band),
      ].map(([x, y], i) => (i === 3 ? onRight(a, WALL - sill - band) : [x, y])),
      '#ffffff',
      ' fill-opacity=".35"',
    )
  }
  art += face(
    onWall(onRight, w0 - 50, w1 + 50, WALL - sill, WALL - sill + 30),
    '#ffffff',
    ' fill-opacity=".7"',
  )

  const deep = 520
  const z0 = WALL
  const z1 = WALL + SLAB
  art += face(
    [at(REACH, deep, z0), at(deep, deep, z0), at(deep, deep, z1), at(REACH, deep, z1)],
    '#d8d3cb',
  )
  art += face(
    [at(deep, deep, z0), at(deep, REACH, z0), at(deep, REACH, z1), at(deep, deep, z1)],
    '#cbc5bc',
  )
  const lid = [
    at(0, 0, z1),
    at(REACH, 0, z1),
    at(REACH, deep, z1),
    at(deep, deep, z1),
    at(deep, REACH, z1),
    at(0, REACH, z1),
  ]
  art += face(lid, ceiling.fill) + face(lid, '#ffffff', ' fill-opacity=".06"')
  art += `<path d="M${at(REACH, deep, z0).map(f).join(' ')}L${at(deep, deep, z0).map(f).join(' ')}L${at(deep, REACH, z0).map(f).join(' ')}" fill="none" stroke="#000000" stroke-opacity=".12"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD}" height="${CARD}" viewBox="0 0 ${CARD} ${CARD}"><defs>${defs.join('')}</defs>${art}</svg>\n`
}

for (const style of STYLES) write(style.picture, card(style))
