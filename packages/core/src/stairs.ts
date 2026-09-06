import { flightOf, HEADROOM, SLAB } from './levels'

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
/** How many treads a winder puts in its corner. */
const WINDERS = 3

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
  /** The room it takes on the floor. */
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
  const flight = Math.max(700, Math.round(across ?? (kind === 'spiral' ? SPIRAL : WIDTH)))
  return { kind, risers, riser, going, flight, size: sizeOf(kind, risers, going, flight) }
}

/**
 * The clear width of a flight, read back off the footprint it made.
 *
 * `sizeOf` is a pure function of the kind, the risers and the flight's width,
 * so it inverts exactly — which is what lets a staircase already in a plan be
 * re-drawn when its storey changes height without its width drifting.
 */
export function flightWidthOf(kind: StairKind, footprint: number, height: number): number {
  const { risers, going } = flightOf(height)
  if (kind === 'u') return Math.round(footprint / 2)
  if (kind === 'straight' || kind === 'spiral') return Math.round(footprint)
  return Math.round(footprint - armsOf(kind, risers).away * going)
}

/**
 * How a flight's treads are shared out between its arms.
 *
 * The last riser lands on the floor above, so a flight has one tread fewer
 * than it has risers — the floor itself is the last step. Of those, a landing
 * is one, a winder's corner is three, and the rest are split between the arm
 * up and the arm away, the arm up taking the odd one. This is the one place
 * that decides it, so the footprint and the treads cannot disagree about how
 * long an arm is — which is how an L came out two treads longer than its
 * storey and a winder two shorter.
 */
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
    // A spiral is as wide as it is deep, and its width is its diameter.
    return { width, depth: width }
  }
  if (kind === 'straight') return { width, depth: up * going }
  if (kind === 'u') {
    // Two flights side by side with a half landing across their heads.
    return { width: width * 2, depth: up * going + width }
  }
  // Both Ls turn a right angle: a square the width of the flight in the corner,
  // the arm up beside it and the arm away along the head.
  return { width: away * going + width, depth: up * going + width }
}

/** A point on the footprint, in its own millimetres. */
export type Point = { x: number; y: number }

/**
 * One tread of a flight, in the footprint's own millimetres: x across from the
 * left, y down from the back, the foot of the flight at the bottom.
 *
 * An outline rather than a box, because a tread is not always a box: a winder
 * turns its corner on wedges, and a spiral is nothing but.
 */
export type Tread = {
  /** Which riser it sits on, counting one from the foot. The floor above is the last. */
  step: number
  /** Its corners, in order round it. */
  outline: Point[]
}

/**
 * Every tread of a flight, in the order they are climbed.
 *
 * The one description of what a staircase is made of. The plan symbol draws
 * them, the walk builds them and the well above is cut round them, so the
 * flight you look down on and the flight you climb cannot be two different
 * staircases — which they were: one drawn at the storey's own tread count and
 * the other a straight run of slabs 1400 tall, whatever the kind and whatever
 * the storey.
 */
export function treadsOf(shape: StairShape): Tread[] {
  if (shape.kind === 'spiral') return spiralTreads(shape)
  if (shape.kind === 'straight') return straightTreads(shape)
  if (shape.kind === 'u') return uTreads(shape)
  return ellTreads(shape)
}

/**
 * How many treads at the foot of the flight the floor above can go over.
 *
 * A well is not the whole flight seen from above: the floor overhead only has
 * to be missing where somebody climbing would otherwise hit it. Over the first
 * few treads there is a storey of air, less the slab, and while that is still
 * the headroom a person needs, the floor stays.
 */
export function coveredTreads(shape: StairShape): number {
  const height = shape.risers * shape.riser
  return Math.max(
    0,
    Math.min(shape.risers - 1, Math.floor((height - SLAB - HEADROOM) / shape.riser)),
  )
}

/** A rectangle square to the footprint, given by its edges. */
const box = (step: number, x: number, y: number, width: number, depth: number): Tread => ({
  step,
  outline: [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + depth },
    { x, y: y + depth },
  ],
})

/** One flight, foot at the bottom. */
function straightTreads(shape: StairShape): Tread[] {
  const { width, depth } = shape.size
  const { up } = armsOf(shape.kind, shape.risers)
  return Array.from({ length: up }, (_, index) =>
    box(index + 1, 0, depth - (index + 1) * shape.going, width, shape.going),
  )
}

/** Up the right-hand flight, across the half landing, and down the left: that is a U. */
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

/** Up the left-hand arm, round the corner, and away along the head of the drawing. */
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

/**
 * Three treads fanning round the inside of the turn, which is the one point
 * they all meet at: the bottom right of the corner square. A right angle in
 * three equal turns, each wedge reaching from that corner out to the edge.
 */
function winders(corner: number, first: number): Tread[] {
  const inside = { x: corner, y: corner }
  // Where a line from the inside corner meets the outer edge, a third of the
  // way round: the far end of the wedge between the arm up and the arm away.
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

/** Where the treads of a spiral start: at the foot, which is at the bottom the way every other flight's is. */
const FOOT = Math.PI / 2

/**
 * Wedges round the newel, from the newel out to the circle the spiral stands
 * in. The outer edge is an arc, taken in a few straight pieces, so a tread
 * never reaches past its own well — a tread that does is a tread the floor
 * above lands on.
 */
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

/** A tread as the plan draws it: a white body with a line round it. */
function drawn(tread: Tread): string {
  const path = tread.outline.map(
    (point, index) => `${index === 0 ? 'M' : 'L'} ${round(point.x)} ${round(point.y)}`,
  )
  return `<path d="${path.join(' ')} Z" fill="#ffffff" stroke="${LINE}" stroke-width="14"/>`
}

const round = (value: number) => Math.round(value * 10) / 10

/**
 * The staircase as a plan symbol: the same treads the walk is built from, drawn
 * from above.
 *
 * Head to foot the way it is walked, with the bottom of the flight at the foot
 * of the drawing, so a thing standing against a wall climbs towards it. A
 * spiral is drawn the way a plan draws one — the circle it stands in, the newel
 * and a nosing to each tread — rather than as its wedges, because from above a
 * spiral is a circle and a ring of lines, and wedges fanned round a newel read
 * as a pinwheel.
 */
export function stairSymbol(shape: StairShape): string {
  const { width, depth } = shape.size
  return [
    `<svg width="${round(width)}" height="${round(depth)}" viewBox="0 0 ${round(width)} ${round(depth)}" fill="none" xmlns="http://www.w3.org/2000/svg">`,
    `<g>`,
    shape.kind === 'spiral' ? spiral(shape) : treadsOf(shape).map(drawn).join(''),
    '</g></svg>',
  ].join('')
}

/**
 * A spiral: a newel in the middle and the treads round it, each a wedge.
 *
 * The reference has no spiral, so this is drawn from scratch — which is the whole point
 * of the staircase being generated. The nosings are the wedges' own edges, so
 * the drawing and the flight in the walk turn the same amount a tread.
 */
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
