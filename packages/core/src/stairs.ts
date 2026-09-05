import { flightOf } from './levels'

/**
 * Staircases, drawn rather than stamped.
 *
 * Every other thing in the plan is a symbol scaled to its size: a sofa is the
 * same drawing whether it is two metres or three. A staircase is not, because
 * the one number nobody chooses — the height of the storey — decides how many
 * risers it has, and a flight drawn with the wrong number of treads is a
 * drawing of a staircase nobody could climb. So the symbol is made here, in the
 * same language the catalogue's own symbols are written in: white bodies, a
 * dark line round each, nothing else.
 *
 * That the drawing is generated is also what lets a staircase be real. It knows
 * its run, so the well it needs in the floor above is its own footprint, and
 * `add-object` can refuse a flight the room is too short for instead of drawing
 * one that stops in a wall.
 */

/** The kinds of staircase, and the shape each of them makes on a plan. */
export const STAIR_KINDS = ['straight', 'l-landing', 'l-winder', 'u', 'spiral'] as const
export type StairKind = (typeof STAIR_KINDS)[number]

/** Which type is which kind of flight. Anything else is not a staircase. */
const KINDS: Record<string, StairKind> = {
  'stairs-straight': 'straight',
  'stairs-l-landing': 'l-landing',
  'stairs-l-winder': 'l-winder',
  'stairs-u': 'u',
  'stairs-spiral': 'spiral',
}

export const stairKind = (type: string): StairKind | undefined => KINDS[type]
export const isStaircase = (type: string): boolean => type in KINDS

/** A flight this wide is one somebody can carry a bed up. */
const WIDTH = 900
/**
 * Across a spiral, unless told otherwise.
 *
 * A spiral is the one kind whose width is its whole footprint rather than the
 * walk up it: at 900 across, the outer end of every tread is 450 from the newel
 * and the inner end is nothing at all, which is a ladder.
 */
const SPIRAL = 1600
/** Round the well and the flight, the line a plan is drawn with. */
const LINE = '#212121'

export type StairShape = {
  kind: StairKind
  /** How many risers it climbs, which is the storey's height over a comfortable rise. */
  risers: number
  /** How high each one is. */
  riser: number
  /** How deep each tread is, front to back. */
  going: number
  /** The clear width of one flight, which is also the landing it turns on. */
  flight: number
  /** The room it takes on the floor, which is also the well it needs above. */
  size: { width: number; depth: number }
}

/**
 * The staircase a storey of this height needs, at this width.
 *
 * The size is worked out, not asked for: a flight is as long as its treads make
 * it. What a caller may say is the clear width of the flight — how wide the
 * stair is to walk up, which for a spiral is the whole circle — and the rest
 * follows from the climb. A U is two of those side by side and comes out twice
 * as wide; that is the footprint, not the width anybody asked for.
 */
export function stairShape(kind: StairKind, height: number, across?: number): StairShape {
  const { risers, riser, going } = flightOf(height)
  // The last riser lands on the floor above, so a flight has one tread fewer
  // than it has risers — the floor itself is the last step.
  const treads = risers - 1
  const flight = Math.max(700, Math.round(across ?? (kind === 'spiral' ? SPIRAL : WIDTH)))
  return { kind, risers, riser, going, flight, size: sizeOf(kind, treads, going, flight) }
}

/**
 * The clear width of a flight, read back off the footprint it made.
 *
 * `sizeOf` is a pure function of the kind, the treads and the flight's width,
 * so it inverts exactly — which is what lets a staircase already in a plan be
 * re-drawn when its storey changes height without its width drifting.
 */
export function flightWidthOf(kind: StairKind, footprint: number, height: number): number {
  const { risers, going } = flightOf(height)
  const treads = risers - 1
  if (kind === 'u') return Math.round(footprint / 2)
  if (kind === 'straight' || kind === 'spiral') return Math.round(footprint)
  const corner = kind === 'l-winder' ? 3 : 0
  const arms = Math.max(1, treads - corner)
  return Math.round(footprint - Math.ceil(arms / 2) * going)
}

function sizeOf(
  kind: StairKind,
  treads: number,
  going: number,
  width: number,
): { width: number; depth: number } {
  if (kind === 'spiral') {
    // A spiral is as wide as it is deep, and its width is its diameter.
    return { width, depth: width }
  }
  if (kind === 'straight') return { width, depth: treads * going }
  if (kind === 'u') {
    // Two flights side by side with a half landing across their heads.
    const perFlight = Math.ceil(treads / 2)
    return { width: width * 2, depth: perFlight * going + width }
  }
  // Both Ls turn a right angle: a landing the width of the flight in the corner,
  // and the treads split between the two arms. A winder puts three of them in
  // the corner itself, so its arms are shorter by those three.
  const corner = kind === 'l-winder' ? 3 : 0
  const arms = Math.max(1, treads - corner)
  const along = Math.ceil(arms / 2)
  return { width: along * going + width, depth: Math.ceil(arms / 2) * going + width }
}

/**
 * One tread of a flight, in the footprint's own millimetres: x across from the
 * left, y down from the back, the foot of the flight at the bottom.
 *
 * A tread is a rectangle round its own middle, turned about that middle — which
 * is only ever anything but square for a spiral, whose treads fan round a newel.
 */
export type Tread = {
  /** Which riser it sits on, counting one from the foot. The floor above is the last. */
  step: number
  /** The middle of the tread. */
  cx: number
  cy: number
  width: number
  depth: number
  /** How far it is turned about its own middle. */
  turn: number
}

/**
 * Every tread of a flight, in the order they are climbed.
 *
 * The one description of what a staircase is made of. The plan symbol draws
 * them and the walk builds them, so the flight you look down on and the flight
 * you climb cannot be two different staircases — which they were: one drawn at
 * the storey's own tread count and the other a straight run of slabs 1400 tall,
 * whatever the kind and whatever the storey.
 */
export function treadsOf(shape: StairShape): Tread[] {
  if (shape.kind === 'spiral') return spiralTreads(shape)
  if (shape.kind === 'straight') return straightTreads(shape)
  if (shape.kind === 'u') return uTreads(shape)
  return ellTreads(shape)
}

/** A rectangle square to the footprint, given by its edges. */
const flat = (step: number, x: number, y: number, width: number, depth: number): Tread => ({
  step,
  cx: x + width / 2,
  cy: y + depth / 2,
  width,
  depth,
  turn: 0,
})

/** One flight, foot at the bottom. */
function straightTreads(shape: StairShape): Tread[] {
  const { width, depth } = shape.size
  const count = Math.max(1, Math.round(depth / shape.going))
  return Array.from({ length: count }, (_, index) =>
    flat(index + 1, 0, depth - (index + 1) * shape.going, width, shape.going),
  )
}

/** Up the right-hand flight, across the half landing, and down the left: that is a U. */
function uTreads(shape: StairShape): Tread[] {
  const { width, depth } = shape.size
  const landing = shape.flight
  const count = Math.max(1, Math.round((depth - landing) / shape.going))

  const rising = Array.from({ length: count }, (_, index) =>
    flat(index + 1, shape.flight, depth - (index + 1) * shape.going, shape.flight, shape.going),
  )
  const turn = flat(count + 1, 0, 0, width, landing)
  const falling = Array.from({ length: count }, (_, index) =>
    flat(count + 2 + index, 0, landing + index * shape.going, shape.flight, shape.going),
  )
  return [...rising, turn, ...falling]
}

/** Up the left-hand arm, round the corner, and away along the head of the drawing. */
function ellTreads(shape: StairShape): Tread[] {
  const { width, depth } = shape.size
  const corner = shape.flight
  const rising = Math.max(1, Math.round((depth - corner) / shape.going))
  const across = Math.max(1, Math.round((width - corner) / shape.going))

  const up = Array.from({ length: rising }, (_, index) =>
    flat(index + 1, 0, depth - (index + 1) * shape.going, corner, shape.going),
  )
  const turn = flat(rising + 1, 0, 0, corner, corner)
  const away = Array.from({ length: across }, (_, index) =>
    flat(rising + 2 + index, corner + index * shape.going, 0, shape.going, corner),
  )
  return [...up, turn, ...away]
}

/**
 * The numbers a spiral is drawn from: how far out it reaches, the newel it
 * turns about, and how far round each tread carries you.
 */
function spiralOf(shape: StairShape) {
  const radius = shape.flight / 2
  const newel = Math.max(60, radius * 0.16)
  const count = shape.risers - 1
  // A full turn and a bit is what a spiral in a house does; more than that and
  // the treads are too narrow to stand on.
  const sweep = Math.min(Math.PI * 2.2, (Math.PI * 2 * count) / 13)
  return { radius, newel, count, sweep, each: sweep / count }
}

/**
 * Wedges round the newel, taken as the rectangles that fill them.
 *
 * As wide across as the wedge is at its outer corners, which is what puts those
 * corners on the circle the spiral is drawn in rather than a finger's breadth
 * outside it — a tread that reaches past its own well is a tread the floor
 * above lands on.
 */
function spiralTreads(shape: StairShape): Tread[] {
  const { radius, newel, count, each } = spiralOf(shape)
  const across = 2 * radius * Math.sin(each / 2)
  const outer = radius * Math.cos(each / 2)
  const reach = outer - newel
  return Array.from({ length: count }, (_, index) => {
    // From the foot, which is at the bottom the way every other flight's is,
    // and turned half a tread on so the tread fills the wedge rather than
    // straddling the nosing drawn between two of them.
    const angle = Math.PI / 2 + (index + 0.5) * each
    const middle = newel + reach / 2
    return {
      step: index + 1,
      cx: radius + Math.cos(angle) * middle,
      cy: radius + Math.sin(angle) * middle,
      width: reach,
      depth: across,
      turn: angle,
    }
  })
}

/** A tread as the plan draws it: a white body with a line round it. */
function drawn(tread: Tread): string {
  const { cx, cy, width, depth, turn } = tread
  const body = `<rect x="${round(cx - width / 2)}" y="${round(cy - depth / 2)}" width="${round(width)}" height="${round(depth)}" fill="#ffffff" stroke="${LINE}" stroke-width="14"/>`
  if (turn === 0) return body
  return `<g transform="rotate(${round((turn * 180) / Math.PI)} ${round(cx)} ${round(cy)})">${body}</g>`
}

const round = (value: number) => Math.round(value * 10) / 10

/**
 * The staircase as a plan symbol: the same treads the walk is built from, drawn
 * from above.
 *
 * Head to foot the way it is walked, with the bottom of the flight at the foot
 * of the drawing, so a thing standing against a wall climbs away from it. A
 * winder and a spiral get the lines a plan draws them with on top — the fan out
 * of the inside corner, the newel and the nosings round it — because those are
 * conventions of the drawing rather than anything you could stand on.
 */
export function stairSymbol(shape: StairShape): string {
  const { width, depth } = shape.size
  const parts = treadsOf(shape).map(drawn)

  return [
    `<svg width="${round(width)}" height="${round(depth)}" viewBox="0 0 ${round(width)} ${round(depth)}" fill="none" xmlns="http://www.w3.org/2000/svg">`,
    `<g>`,
    shape.kind === 'spiral' ? spiral(shape) : parts.join(''),
    shape.kind === 'l-winder' ? winder(shape) : '',
    '</g></svg>',
  ].join('')
}

/**
 * Three treads fanning from the inside corner of an L, which is the one point
 * they all meet at: the bottom right of the corner square.
 */
function winder(shape: StairShape): string {
  const corner = shape.flight
  const parts: string[] = []
  for (let index = 1; index < 3; index += 1) {
    const angle = (Math.PI / 2) * (index / 3)
    const to = { x: corner - Math.sin(angle) * corner, y: corner - Math.cos(angle) * corner }
    parts.push(
      `<path d="M ${round(corner)} ${round(corner)} L ${round(to.x)} ${round(to.y)}" stroke="${LINE}" stroke-width="14" fill="none"/>`,
    )
  }
  return parts.join('')
}

/**
 * A spiral: a newel in the middle and the treads round it, each a wedge.
 *
 * The reference has no spiral, so this is drawn from scratch — which is the whole point
 * of the staircase being generated. Drawn as the circle it stands in with a
 * nosing to each tread rather than as the rectangles the walk builds, because
 * from above a spiral is a circle and a ring of lines, and boxes fanned round a
 * newel read as a pinwheel.
 */
function spiral(shape: StairShape): string {
  const { radius, newel, count, each } = spiralOf(shape)
  const parts = [
    `<circle cx="${round(radius)}" cy="${round(radius)}" r="${round(radius - 7)}" fill="#ffffff" stroke="${LINE}" stroke-width="14"/>`,
  ]
  for (let index = 0; index <= count; index += 1) {
    // From the foot, which is drawn at the bottom the way every other flight is.
    const angle = Math.PI / 2 + index * each
    parts.push(
      `<path d="M ${round(radius + Math.cos(angle) * newel)} ${round(radius + Math.sin(angle) * newel)} L ${round(radius + Math.cos(angle) * (radius - 7))} ${round(radius + Math.sin(angle) * (radius - 7))}" stroke="${LINE}" stroke-width="14" fill="none"/>`,
    )
  }
  parts.push(
    `<circle cx="${round(radius)}" cy="${round(radius)}" r="${round(newel)}" fill="#ffffff" stroke="${LINE}" stroke-width="14"/>`,
  )
  return parts.join('')
}
