const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10)

function hash(ix, iy, seed) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

const wrap = (i, period) => (period ? ((i % period) + period) % period : i)

function corner(ix, iy, seed, dx, dy) {
  const angle = (hash(ix, iy, seed) / 4294967296) * Math.PI * 2
  return Math.cos(angle) * dx + Math.sin(angle) * dy
}

export function perlin(x, y, seed, px = 0, py = 0) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const [x0, x1, y0, y1] = [wrap(ix, px), wrap(ix + 1, px), wrap(iy, py), wrap(iy + 1, py)]
  const a = corner(x0, y0, seed, fx, fy)
  const b = corner(x1, y0, seed, fx - 1, fy)
  const c = corner(x0, y1, seed, fx, fy - 1)
  const d = corner(x1, y1, seed, fx - 1, fy - 1)
  const u = fade(fx)
  const v = fade(fy)
  return a + (b - a) * u + (c - a + (a - b + d - c) * u) * v
}

export function fbm(x, y, seed, octaves, px = 0, py = 0) {
  let sum = 0
  let amplitude = 1
  let total = 0
  for (let o = 0; o < octaves; o++) {
    const k = 2 ** o
    sum += perlin(x * k, y * k, seed + o * 101, px * k, py * k) * amplitude
    total += amplitude
    amplitude *= 0.5
  }
  return sum / total
}

export function seeded(text) {
  let a = 2166136261
  for (const char of text) a = Math.imul(a ^ char.charCodeAt(0), 16777619)
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const between = (r, a, b) => a + (b - a) * r()
const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export const rgbOf = (hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))

function rich(hex, saturation, light = 1) {
  const c = rgbOf(hex)
  const grey = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11
  return c.map((v) => (grey + (v - grey) * saturation) * light)
}

function rows(r, length, across, look) {
  const count = Math.max(1, Math.round(across / look.plank))
  const height = across / count
  const laid = []
  let previous = []
  for (let row = 0; row < count; row++) {
    const lengths = look.continuous ? [length] : partition(r, length, look)
    let start = 0
    for (let attempt = 0; attempt < 40; attempt++) {
      start = r() * length
      const joints = lengths.map(
        (_, i) => (start + lengths.slice(0, i).reduce((a, b) => a + b, 0)) % length,
      )
      const near = joints.some((j) =>
        previous.some((p) => Math.min(Math.abs(j - p), length - Math.abs(j - p)) < 250),
      )
      if (!near || look.continuous) {
        previous = joints
        break
      }
    }
    let at = 0
    const planks = lengths.map((size) => {
      const plank = { from: at, size, ...board(r, look, size, height) }
      at += size
      return plank
    })
    laid.push({ start, planks })
  }
  return { height, laid }
}

function partition(r, length, look) {
  const [shortest, longest] = look.lengths
  for (let attempt = 0; attempt < 400; attempt++) {
    const n = Math.max(1, Math.round(length / between(r, shortest, longest)))
    const sizes = []
    let left = length
    for (let i = 0; i < n - 1; i++) {
      const size = between(r, shortest, longest)
      sizes.push(size)
      left -= size
    }
    sizes.push(left)
    if (sizes.every((size) => size >= shortest && size <= longest)) return sizes
  }
  throw new Error(`cannot cut ${length} into planks of ${shortest}-${longest}`)
}

function board(r, look, size, height) {
  const flat = r() < look.flatSawn
  const knots = []
  for (let k = 0; k < 3; k++) {
    if (r() < look.knots) {
      knots.push({
        u: between(r, 150, size - 150),
        v: between(r, height * 0.2, height * 0.8),
        radius: between(r, 4, 13),
      })
    }
  }
  return {
    ox: between(r, 0, 1e5),
    oy: between(r, 0, 1e5),
    pith:
      height / 2 +
      (flat ? between(r, -0.35, 0.35) * height : (r() < 0.5 ? -1 : 1) * between(r, 220, 520)),
    depth: flat ? between(r, 80, 260) : between(r, 5, 80),
    tilt: (r() < 0.5 ? -1 : 1) * (flat ? between(r, 0.004, 0.016) : between(r, 0, 0.003)),
    bow: flat ? between(r, -1, 1) * 1.2e-5 : 0,
    swing: between(r, 0, Math.PI * 2),
    spacing: look.spacing * between(r, 0.75, 1.3),
    shade: 1 + between(r, -1, 1) * look.vary * (r() < 0.2 ? 1.5 : 1),
    warm: between(r, -0.3, 1) * look.warmth,
    heart: r() < look.heart ? between(r, 0.4, 1) : 0,
    seed: Math.floor(r() * 1e6),
    knots,
  }
}

function sampleBoard(p, u, v, length, look, period, along) {
  const warp = fbm((u + p.ox) / along.warp, (v + p.oy) / 40, p.seed, 3, period.warp) * look.warp
  const lean = look.continuous
    ? Math.sin((u / length) * Math.PI * 2 + p.swing) * p.tilt * length * 0.25
    : (u - length / 2) * p.tilt + (u - length / 2) ** 2 * p.bow
  let y = v - p.pith + warp
  let z =
    p.depth + lean + fbm((u + p.ox) / along.slow, (v + p.oy) / 200, p.seed + 7, 2, period.slow) * 12
  let knot = 0
  for (const k of p.knots) {
    const du = (u - k.u) / 3.2
    const dv = v - k.v
    const reach = Math.hypot(du, dv)
    const pull = Math.exp(-(reach * reach) / (k.radius * k.radius * 9))
    y += Math.sign(dv || 1) * pull * k.radius * 2.2
    z += pull * k.radius * 1.5
    const inside = Math.hypot((u - k.u) / 1.9, v - k.v)
    if (inside < k.radius)
      knot = Math.max(
        knot,
        0.55 + 0.25 * Math.cos((inside / k.radius) * Math.PI * 3) * (inside / k.radius),
      )
    else knot = Math.max(knot, 0.5 * Math.exp(-((inside - k.radius) ** 2) / 4))
  }
  const distance = Math.hypot(y, z)
  const irregular =
    fbm((u + p.ox) / along.ring, (v + p.oy) / 30, p.seed + 3, 3, period.ring) * look.irregular
  const ring =
    distance / p.spacing + irregular + perlin(distance / (p.spacing * 2.5), 0.5, p.seed + 29) * 1.1
  const t = ring - Math.floor(ring)
  const late =
    smoothstep(0.25, 0.95, t) *
    (1 - smoothstep(0.93, 1, t)) *
    (0.75 + 0.5 * perlin((u + p.ox) / along.fibre, (v + p.oy) / 2, p.seed + 23, period.fibre))
  const pores = look.pores
    ? smoothstep(
        0.12,
        0.45,
        perlin((u + p.ox) / along.pore, (v + p.oy) / 1.4, p.seed + 11, period.pore),
      ) *
      (1 - late) *
      look.pores
    : 0
  const fibre =
    perlin((u + p.ox) / along.fibre, (v + p.oy) / 0.9, p.seed + 13, period.fibre) * look.fibre
  const fleck = look.flecks
    ? smoothstep(
        0.25,
        0.5,
        perlin((u + p.ox) / along.fleck, (v + p.oy) / 1.6, p.seed + 17, period.fleck),
      ) * look.flecks
    : 0
  const streak =
    fbm((u + p.ox) / along.slow, (v + p.oy) / 70, p.seed + 19, 3, period.slow) * look.streaks
  const tone = 1 - look.rings * late - pores - fleck + fibre + streak
  const heart = p.heart
    ? smoothstep(
        0,
        0.45,
        fbm((u + p.ox) / along.slow, (v + p.oy) / 60, p.seed + 31, 2, period.slow),
      ) * p.heart
    : 0
  return { tone, knot, heart }
}

export function renderWood({ length, across, width, height, look, seed, transpose = false }) {
  const r = seeded(seed)
  const plan = rows(r, length, across, look)
  const scale = width / length
  const desired = { warp: look.warpLength, slow: 900, ring: 700, pore: 11, fibre: 30, fleck: 5 }
  const period = {}
  const along = {}
  for (const [name, size] of Object.entries(desired)) {
    period[name] = look.continuous ? Math.max(1, Math.round(length / size)) : 0
    along[name] = look.continuous ? length / period[name] : size
  }

  const light = rich(look.colour, look.saturation, 1.03)
  const dark = rich(look.late, look.saturation * 1.05)
  const heartColour = rich(look.heartwood ?? look.late, look.saturation, 1.1)
  const knotColour = rich(look.knot ?? look.late, look.saturation).map((v) => v * 0.7)
  const out = new Float32Array(width * height * 3)
  const sub = [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75],
  ]
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      let red = 0
      let green = 0
      let blue = 0
      for (const [sx, sy] of sub) {
        const x = (px + sx) / scale
        const y = (py + sy) / scale
        const row = Math.min(plan.laid.length - 1, Math.floor(y / plan.height))
        const v = y - row * plan.height
        const { start, planks } = plan.laid[row]
        const run = (((x - start) % length) + length) % length
        const plank =
          planks.find((each) => run < each.from + each.size) ?? planks[planks.length - 1]
        const u = run - plank.from
        const { tone, knot, heart } = sampleBoard(plank, u, v, plank.size, look, period, along)
        const overall = perlin((x / length) * 3, (y / across) * 2, 991, 3, 2) * look.drift
        const edge = Math.min(
          v,
          plan.height - v,
          look.continuous ? 1e9 : Math.min(u, plank.size - u),
        )
        const bevel =
          1 - look.bevel * Math.exp(-edge / 0.9) - look.bevel * 0.25 * Math.exp(-edge / 3)
        const t = Math.max(0, Math.min(1.06, tone))
        const middle = (v - plan.height / 2) / (plan.height / 2)
        const sheen = 1 + look.sheen * (1 - middle * middle)
        const shade = plank.shade * bevel * sheen * (1 + overall)
        for (let c = 0; c < 3; c++) {
          let value = dark[c] + (light[c] - dark[c]) * t
          value += (heartColour[c] - value) * heart * 0.3
          value += (knotColour[c] - value) * knot
          const warm = plank.warm + Math.max(0, 1 - plank.shade) * 0.6
          value *= shade * (1 + warm * [0.35, 0.1, -0.7][c])
          if (c === 0) red += value
          else if (c === 1) green += value
          else blue += value
        }
      }
      const i = (py * width + px) * 3
      out[i] = red / 4
      out[i + 1] = green / 4
      out[i + 2] = blue / 4
    }
  }

  const target = rich(look.colour, look.saturation, look.depth)
  const mean = [0, 0, 0]
  for (let i = 0; i < out.length; i++) mean[i % 3] += out[i]
  const gain = mean.map((m, c) => target[c] / (m / (width * height)))
  const pixels = new Uint8Array(width * height * 3)
  for (let i = 0; i < out.length; i++)
    pixels[i] = Math.max(0, Math.min(255, Math.round(out[i] * gain[i % 3])))
  return transpose ? turned(pixels, width, height) : { width, height, pixels }
}

function turned(pixels, width, height) {
  const out = new Uint8Array(pixels.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = (y * width + x) * 3
      const to = (x * height + y) * 3
      out[to] = pixels[from]
      out[to + 1] = pixels[from + 1]
      out[to + 2] = pixels[from + 2]
    }
  }
  return { width: height, height: width, pixels: out }
}
