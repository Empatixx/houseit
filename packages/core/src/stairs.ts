import { flightOf, HEADROOM, SLAB } from './levels'

export const STAIR_KINDS = ['straight', 'l-landing', 'l-winder', 'u', 'spiral'] as const
export type StairKind = (typeof STAIR_KINDS)[number]

const KINDS: Record<string, StairKind> = {
  'stairs-straight': 'straight',
  'stairs-l-landing': 'l-landing',
  'stairs-l-winder': 'l-winder',
  'stairs-u': 'u',
  'stairs-spiral': 'spiral',
}

export const stairKind = (type: string): StairKind | undefined => KINDS[type]
export const isStaircase = (type: string): boolean => type in KINDS

const WIDTH = 900
const SPIRAL = 1600
const LINE = '#212121'
const WINDERS = 3

export type StairShape = {
  kind: StairKind
  risers: number
  riser: number
  going: number
  flight: number
  size: { width: number; depth: number }
}

export function stairShape(kind: StairKind, height: number, across?: number): StairShape {
  const { risers, riser, going } = flightOf(height)
  const flight = Math.max(700, Math.round(across ?? (kind === 'spiral' ? SPIRAL : WIDTH)))
  return { kind, risers, riser, going, flight, size: sizeOf(kind, risers, going, flight) }
}

export function flightWidthOf(kind: StairKind, footprint: number, height: number): number {
  const { risers, going } = flightOf(height)
  if (kind === 'u') return Math.round(footprint / 2)
  if (kind === 'straight' || kind === 'spiral') return Math.round(footprint)
  return Math.round(footprint - armsOf(kind, risers).away * going)
}

function armsOf(kind: StairKind, risers: number): { up: number; away: number } {
  const treads = Math.max(1, risers - 1)
  if (kind === 'straight' || kind === 'spiral') return { up: treads, away: 0 }
  const corner = kind === 'l-winder' ? WINDERS : 1
  const arms = Math.max(1, treads - corner)
  const up = Math.ceil(arms / 2)
  return { up, away: arms - up }
}

function sizeOf(
  kind: StairKind,
  risers: number,
  going: number,
  width: number,
): { width: number; depth: number } {
  const { up, away } = armsOf(kind, risers)
  if (kind === 'spiral') {
    return { width, depth: width }
  }
  if (kind === 'straight') return { width, depth: up * going }
  if (kind === 'u') {
    return { width: width * 2, depth: up * going + width }
  }
  return { width: away * going + width, depth: up * going + width }
}

export type Point = { x: number; y: number }

export type Tread = {
  step: number
  outline: Point[]
}

export function treadsOf(shape: StairShape): Tread[] {
  if (shape.kind === 'spiral') return spiralTreads(shape)
  if (shape.kind === 'straight') return straightTreads(shape)
  if (shape.kind === 'u') return uTreads(shape)
  return ellTreads(shape)
}

export function coveredTreads(shape: StairShape): number {
  const height = shape.risers * shape.riser
  return Math.max(
    0,
    Math.min(shape.risers - 1, Math.floor((height - SLAB - HEADROOM) / shape.riser)),
  )
}

const box = (step: number, x: number, y: number, width: number, depth: number): Tread => ({
  step,
  outline: [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + depth },
    { x, y: y + depth },
  ],
})

function straightTreads(shape: StairShape): Tread[] {
  const { width, depth } = shape.size
  const { up } = armsOf(shape.kind, shape.risers)
  return Array.from({ length: up }, (_, index) =>
    box(index + 1, 0, depth - (index + 1) * shape.going, width, shape.going),
  )
}

function uTreads(shape: StairShape): Tread[] {
  const { width, depth } = shape.size
  const { up, away } = armsOf(shape.kind, shape.risers)
  const landing = shape.flight

  const rising = Array.from({ length: up }, (_, index) =>
    box(index + 1, shape.flight, depth - (index + 1) * shape.going, shape.flight, shape.going),
  )
  const turn = box(up + 1, 0, 0, width, landing)
  const falling = Array.from({ length: away }, (_, index) =>
    box(up + 2 + index, 0, landing + index * shape.going, shape.flight, shape.going),
  )
  return [...rising, turn, ...falling]
}

function ellTreads(shape: StairShape): Tread[] {
  const { depth } = shape.size
  const corner = shape.flight
  const { up, away } = armsOf(shape.kind, shape.risers)

  const rising = Array.from({ length: up }, (_, index) =>
    box(index + 1, 0, depth - (index + 1) * shape.going, corner, shape.going),
  )
  const turn =
    shape.kind === 'l-winder' ? winders(corner, up + 1) : [box(up + 1, 0, 0, corner, corner)]
  const going = Array.from({ length: away }, (_, index) =>
    box(up + turn.length + 1 + index, corner + index * shape.going, 0, shape.going, corner),
  )
  return [...rising, ...turn, ...going]
}

function winders(corner: number, first: number): Tread[] {
  const inside = { x: corner, y: corner }
  const reach = corner * (1 - Math.tan(Math.PI / 6))
  return [
    { step: first, outline: [inside, { x: 0, y: corner }, { x: 0, y: reach }] },
    {
      step: first + 1,
      outline: [inside, { x: 0, y: reach }, { x: 0, y: 0 }, { x: reach, y: 0 }],
    },
    { step: first + 2, outline: [inside, { x: reach, y: 0 }, { x: corner, y: 0 }] },
  ]
}

function spiralOf(shape: StairShape) {
  const radius = shape.flight / 2
  const newel = Math.max(60, radius * 0.16)
  const count = shape.risers - 1
  const sweep = Math.min(Math.PI * 2.2, (Math.PI * 2 * count) / 13)
  return { radius, newel, count, sweep, each: sweep / count }
}

const FOOT = Math.PI / 2

function spiralTreads(shape: StairShape): Tread[] {
  const { radius, newel, count, each } = spiralOf(shape)
  const outer = radius - 7
  const at = (angle: number, reach: number) => ({
    x: radius + Math.cos(angle) * reach,
    y: radius + Math.sin(angle) * reach,
  })
  return Array.from({ length: count }, (_, index) => {
    const from = FOOT + index * each
    const to = from + each
    const arc = [0, 0.25, 0.5, 0.75, 1].map((part) => at(from + part * (to - from), outer))
    return { step: index + 1, outline: [at(from, newel), ...arc, at(to, newel)] }
  })
}

function drawn(tread: Tread): string {
  const path = tread.outline.map(
    (point, index) => `${index === 0 ? 'M' : 'L'} ${round(point.x)} ${round(point.y)}`,
  )
  return `<path d="${path.join(' ')} Z" fill="#ffffff" stroke="${LINE}" stroke-width="14"/>`
}

const round = (value: number) => Math.round(value * 10) / 10

export function stairSymbol(shape: StairShape): string {
  const { width, depth } = shape.size
  return [
    `<svg width="${round(width)}" height="${round(depth)}" viewBox="0 0 ${round(width)} ${round(depth)}" fill="none" xmlns="http://www.w3.org/2000/svg">`,
    `<g>`,
    shape.kind === 'spiral' ? spiral(shape) : treadsOf(shape).map(drawn).join(''),
    '</g></svg>',
  ].join('')
}

function spiral(shape: StairShape): string {
  const { radius, newel, count, each } = spiralOf(shape)
  const parts = [
    `<circle cx="${round(radius)}" cy="${round(radius)}" r="${round(radius - 7)}" fill="#ffffff" stroke="${LINE}" stroke-width="14"/>`,
  ]
  for (let index = 0; index <= count; index += 1) {
    const angle = FOOT + index * each
    parts.push(
      `<path d="M ${round(radius + Math.cos(angle) * newel)} ${round(radius + Math.sin(angle) * newel)} L ${round(radius + Math.cos(angle) * (radius - 7))} ${round(radius + Math.sin(angle) * (radius - 7))}" stroke="${LINE}" stroke-width="14" fill="none"/>`,
    )
  }
  parts.push(
    `<circle cx="${round(radius)}" cy="${round(radius)}" r="${round(newel)}" fill="#ffffff" stroke="${LINE}" stroke-width="14"/>`,
  )
  return parts.join('')
}
