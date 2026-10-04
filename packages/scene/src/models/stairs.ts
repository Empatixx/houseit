import { flightWidthOf, type StairKind, stairShape, treadsOf } from '@houseit/core/stairs'
import { type Corner, drum, type Finish, type Piece, prism } from '../pieces'
import type { Builder } from './builder'

const BOARD = 35
const RISER: Finish = { colour: '#f1f0ed' }
const RAIL = 900
const HANDRAIL = { width: 50, height: 42 }
const BALUSTER = 22
const NEWEL = 64
const SPACING = 320
const INSET = 45
const SHORTEST = 30

type Step = { step: number; outline: Corner[]; top: number; middle: Corner }
type Edge = { step: number; tread: number; a: Corner; b: Corner; outward: Corner }
type Side = Edge & { mid: Corner; length: number }

export const staircase =
  (kind: StairKind): Builder =>
  ({ w, h, body, frame }) => {
    const shape = stairShape(kind, h, flightWidthOf(kind, w, h))
    const rise = h / shape.risers
    const steps: Step[] = treadsOf(shape).map((tread) => {
      const outline = tread.outline.map((point) => ({
        x: shape.size.width / 2 - point.x,
        z: shape.size.depth / 2 - point.y,
      }))
      return { step: tread.step, outline, top: tread.step * rise, middle: centroid(outline) }
    })

    const treads = steps.flatMap((step) => [
      {
        ...prism({ outline: step.outline, base: step.top - BOARD, thickness: BOARD, paint: body }),
        name: `tread-${step.step}`,
      },
      {
        ...prism({
          outline: step.outline,
          base: step.top - rise,
          thickness: rise - BOARD,
          paint: RISER,
        }),
        name: `riser-${step.step}`,
      },
    ])
    return [
      ...treads.map((piece) => ({ ...piece, role: 'stair-solid' as const })),
      ...(kind === 'spiral'
        ? [
            {
              ...drum({ r: newelOf(shape.flight), h: h + RAIL, paint: frame }),
              role: 'stair-solid' as const,
            },
          ]
        : []),
      ...balustrade(steps, rise, body, frame, kind === 'spiral' ? newelOf(shape.flight) * 1.6 : 0),
    ]
  }

function balustrade(
  steps: Step[],
  rise: number,
  paint: Finish,
  posts: Finish,
  core: number,
): Piece[] {
  const sides = freeSides(steps).filter((side) => Math.hypot(side.mid.x, side.mid.z) > core)
  const pieces: Piece[] = []
  let named = 0
  const unique = (name: string) => `${name}-${++named}`
  let rails = 0
  const rod = (from: Corner & { y: number }, to: Corner & { y: number }) =>
    segment(unique('handrail'), from, to, paint, ++rails % 2 === 0)
  const index = (step: number) => steps.findIndex((s) => s.step === step)
  const height = (side: Side) => steps[index(side.step)]!.top
  const climb = (point: Corner, step: number) => {
    const n = index(step)
    const here = steps[n]!
    const before = steps[n - 1]?.middle ?? here.middle
    const after = steps[n + 1]?.middle ?? here.middle
    const way = direction(before, after)
    const reach = Math.max(
      1,
      ...here.outline.map((p) =>
        Math.abs(dot(way, { x: p.x - here.middle.x, z: p.z - here.middle.z })),
      ),
    )
    const along = dot(way, { x: point.x - here.middle.x, z: point.z - here.middle.z }) / (2 * reach)
    return here.top + Math.max(-0.5, Math.min(0.5, along)) * rise + RAIL
  }
  const inset = (point: Corner, side: Side) => ({
    x: point.x - side.outward.x * INSET,
    z: point.z - side.outward.z * INSET,
  })
  const touching = (a: Side, b: Side) =>
    [a.a, a.b].flatMap((p) => [b.a, b.b].filter((q) => near(p, q)).map(() => p))[0]

  const placed: (Corner & { step: number })[] = []
  for (const side of sides) {
    const count = Math.max(1, Math.ceil(side.length / SPACING))
    for (let k = 0; k < count; k += 1) {
      const at = inset(lerp(side.a, side.b, (k + 0.5) / count), side)
      if (placed.some((p) => p.step === side.step && distance(p, at) < SPACING * 0.7)) continue
      placed.push({ ...at, step: side.step })
      pieces.push(
        post(
          unique(`baluster-${side.step}`),
          at,
          height(side),
          climb(at, side.step) - height(side) - HANDRAIL.height,
          BALUSTER,
          posts,
        ),
      )
    }
  }

  const links = new Map<Side, number>()
  sides.forEach((one, i) => {
    for (const other of sides.slice(i + 1)) {
      if (Math.abs(one.step - other.step) > 4) continue
      const corner = touching(one, other)
      if (!corner) continue
      links.set(one, (links.get(one) ?? 0) + 1)
      links.set(other, (links.get(other) ?? 0) + 1)
      const start = inset(one.mid, one),
        end = inset(other.mid, other)
      const from = { ...start, y: climb(start, one.step) }
      const to = { ...end, y: climb(end, other.step) }
      const bend = Math.abs(dot(one.outward, other.outward))
      if (one.step === other.step && bend < 0.94) {
        const turn = {
          x: corner.x - (one.outward.x + other.outward.x) * INSET,
          z: corner.z - (one.outward.z + other.outward.z) * INSET,
          y: (from.y + to.y) / 2,
        }
        pieces.push(
          ...rod(from, turn),
          ...rod(turn, to),
          knuckle(unique('handrail-corner'), turn, paint),
        )
      } else pieces.push(...rod(from, to))
    }
  })

  for (const side of sides) {
    for (const end of [side.a, side.b]) {
      const joined = sides.some(
        (other) =>
          other !== side &&
          Math.abs(other.step - side.step) <= 4 &&
          (near(end, other.a) || near(end, other.b)),
      )
      if (joined) continue
      const at = inset(lerp(end, side.mid, Math.min(1, NEWEL / side.length)), side)
      const mid = inset(side.mid, side)
      pieces.push(
        post(
          unique('newel'),
          at,
          height(side),
          climb(at, side.step) - height(side) + 40,
          NEWEL,
          paint,
        ),
      )
      pieces.push(...rod({ ...at, y: climb(at, side.step) }, { ...mid, y: climb(mid, side.step) }))
    }
  }
  return pieces
}

function freeSides(steps: Step[]): Side[] {
  const edges: Edge[] = steps.flatMap((step, tread) =>
    step.outline.map((a, i) => {
      const b = step.outline[(i + 1) % step.outline.length]!
      return { step: step.step, tread, a, b, outward: outwardOf(a, b, step.middle) }
    }),
  )
  const first = steps[0]!,
    last = steps[steps.length - 1]!
  const start = direction(first.middle, (steps[1] ?? first).middle)
  const finish = direction((steps[steps.length - 2] ?? last).middle, last.middle)
  const sides: Side[] = []
  for (const edge of edges) {
    if (edge.step === first.step && dot(edge.outward, start) < -0.7) continue
    if (edge.step === last.step && dot(edge.outward, finish) > 0.7) continue
    const covers = edges
      .filter((other) => other.tread !== edge.tread && Math.abs(other.step - edge.step) <= 1)
      .map((other) => overlap(edge, other))
      .filter((range): range is [number, number] => range !== undefined)
    const length = distance(edge.a, edge.b)
    for (const [from, to] of uncovered(covers)) {
      const a = lerp(edge.a, edge.b, from),
        b = lerp(edge.a, edge.b, to)
      const span = (to - from) * length
      if (span < SHORTEST) continue
      sides.push({ ...edge, a, b, mid: lerp(a, b, 0.5), length: span })
    }
  }
  return sides
}

function overlap(edge: Edge, other: Edge): [number, number] | undefined {
  const along = direction(edge.a, edge.b)
  const length = distance(edge.a, edge.b)
  const off = (p: Corner) => Math.abs((p.x - edge.a.x) * along.z - (p.z - edge.a.z) * along.x)
  if (off(other.a) > 1 || off(other.b) > 1) return undefined
  const t = (p: Corner) => ((p.x - edge.a.x) * along.x + (p.z - edge.a.z) * along.z) / length
  const from = Math.max(0, Math.min(t(other.a), t(other.b)))
  const to = Math.min(1, Math.max(t(other.a), t(other.b)))
  return to - from > 1e-6 ? [from, to] : undefined
}

function uncovered(covers: [number, number][]): [number, number][] {
  const sorted = [...covers].sort((a, b) => a[0] - b[0])
  const free: [number, number][] = []
  let at = 0
  for (const [from, to] of sorted) {
    if (from > at) free.push([at, from])
    at = Math.max(at, to)
  }
  if (at < 1) free.push([at, 1])
  return free
}

function post(
  name: string,
  at: Corner,
  base: number,
  height: number,
  size: number,
  paint: Finish,
): Piece {
  return {
    name,
    body: { kind: 'box', width: size, height, depth: size },
    at: { x: at.x, y: base + height / 2, z: at.z },
    paint,
  }
}

function segment(
  name: string,
  from: Corner & { y: number },
  to: Corner & { y: number },
  paint: Finish,
  slender: boolean,
): Piece[] {
  const dx = to.x - from.x,
    dy = to.y - from.y,
    dz = to.z - from.z
  const length = Math.hypot(dx, dy, dz)
  if (length < 1) return []
  const slim = slender ? 4 : 0
  return [
    {
      name,
      body: {
        kind: 'box',
        width: HANDRAIL.width - slim,
        height: length,
        depth: HANDRAIL.height - slim,
      },
      at: {
        x: (from.x + to.x) / 2,
        y: (from.y + to.y) / 2 - HANDRAIL.height / 2,
        z: (from.z + to.z) / 2,
      },
      turn: Math.atan2(dx, dz),
      tilt: Math.acos(Math.max(-1, Math.min(1, dy / length))),
      paint,
    },
  ]
}

const newelOf = (flight: number) => Math.max(60, (flight / 2) * 0.16)

function knuckle(name: string, at: Corner & { y: number }, paint: Finish): Piece {
  const size = HANDRAIL.width + 6
  return {
    name,
    body: { kind: 'box', width: size, height: HANDRAIL.height + 6, depth: size },
    at: { x: at.x, y: at.y - HANDRAIL.height / 2, z: at.z },
    paint,
  }
}

const centroid = (outline: Corner[]) => ({
  x: outline.reduce((sum, p) => sum + p.x, 0) / outline.length,
  z: outline.reduce((sum, p) => sum + p.z, 0) / outline.length,
})
const distance = (a: Corner, b: Corner) => Math.hypot(b.x - a.x, b.z - a.z)
const near = (a: Corner, b: Corner) => distance(a, b) < 2
const lerp = (a: Corner, b: Corner, t: number) => ({
  x: a.x + (b.x - a.x) * t,
  z: a.z + (b.z - a.z) * t,
})
const dot = (a: Corner, b: Corner) => a.x * b.x + a.z * b.z
function direction(a: Corner, b: Corner) {
  const length = distance(a, b) || 1
  return { x: (b.x - a.x) / length, z: (b.z - a.z) / length }
}
function outwardOf(a: Corner, b: Corner, middle: Corner) {
  const along = direction(a, b)
  const normal = { x: along.z, z: -along.x }
  const mid = lerp(a, b, 0.5)
  return dot(normal, { x: mid.x - middle.x, z: mid.z - middle.z }) >= 0
    ? normal
    : { x: -normal.x, z: -normal.z }
}
