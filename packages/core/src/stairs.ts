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

/** A rectangle in the symbol's own coordinates, which are millimetres here. */
const box = (x: number, y: number, width: number, depth: number) =>
  `<rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(depth)}" fill="#ffffff" stroke="${LINE}" stroke-width="14"/>`

const round = (value: number) => Math.round(value * 10) / 10

/**
 * The staircase as a plan symbol.
 *
 * Drawn head to foot the way it is walked: the bottom of the flight at the foot
 * of the drawing, so a thing standing against a wall climbs away from it. The
 * treads are the lines across; the body round them is the flight itself.
 */
export function stairSymbol(shape: StairShape): string {
  const { width, depth } = shape.size
  const inner =
    shape.kind === 'spiral'
      ? spiral(shape)
      : shape.kind === 'straight'
        ? straight(shape)
        : shape.kind === 'u'
          ? uShaped(shape)
          : ell(shape)

  return [
    `<svg width="${round(width)}" height="${round(depth)}" viewBox="0 0 ${round(width)} ${round(depth)}" fill="none" xmlns="http://www.w3.org/2000/svg">`,
    `<g>`,
    inner,
    '</g></svg>',
  ].join('')
}

/** One flight, foot at the bottom, every tread a line across it. */
function straight(shape: StairShape): string {
  const { width, depth } = shape.size
  const treads = Math.max(1, Math.round(depth / shape.going))
  return Array.from({ length: treads }, (_, index) =>
    box(0, depth - (index + 1) * shape.going, width, shape.going),
  ).join('')
}

/** Two flights side by side, and the half landing they turn on across their heads. */
function uShaped(shape: StairShape): string {
  const { width, depth } = shape.size
  const landing = shape.flight
  const treads = Math.max(1, Math.round((depth - landing) / shape.going))
  const parts = [box(0, 0, width, landing)]
  for (let index = 0; index < treads; index += 1) {
    const y = depth - (index + 1) * shape.going
    // Up the right-hand flight and down the left, which is what a U is.
    parts.push(box(shape.flight, y, shape.flight, shape.going))
    parts.push(box(0, landing + index * shape.going, shape.flight, shape.going))
  }
  return parts.join('')
}

/**
 * A right angle: up from the foot on the left, a corner at the top of it, then
 * away to the right along the head of the drawing.
 *
 * The corner is the flight's own width square. A landing stair leaves it plain
 * — it is a place to stand — and a winder cuts it into three tapered treads,
 * which is what buys the two shorter arms.
 */
function ell(shape: StairShape): string {
  const { width, depth } = shape.size
  const corner = shape.flight
  const rising = Math.max(1, Math.round((depth - corner) / shape.going))
  const across = Math.max(1, Math.round((width - corner) / shape.going))

  const parts = [box(0, 0, corner, corner)]
  for (let index = 0; index < rising; index += 1) {
    parts.push(box(0, depth - (index + 1) * shape.going, corner, shape.going))
  }
  for (let index = 0; index < across; index += 1) {
    parts.push(box(corner + index * shape.going, 0, shape.going, corner))
  }

  if (shape.kind === 'l-winder') {
    // Three treads fanning from the inside corner, which is the one point they
    // all meet at. The inside corner is the bottom right of the square.
    const pivot = { x: corner, y: corner }
    for (let index = 1; index < 3; index += 1) {
      const angle = (Math.PI / 2) * (index / 3)
      const to = { x: corner - Math.sin(angle) * corner, y: corner - Math.cos(angle) * corner }
      parts.push(
        `<path d="M ${round(pivot.x)} ${round(pivot.y)} L ${round(to.x)} ${round(to.y)}" stroke="${LINE}" stroke-width="14" fill="none"/>`,
      )
    }
  }
  return parts.join('')
}

/**
 * A spiral: a newel in the middle and the treads round it, each a wedge.
 *
 * The reference has no spiral, so this is drawn from scratch — which is the whole point
 * of the staircase being generated. The tread count is the storey's, so a tall
 * storey turns further round than a low one.
 */
function spiral(shape: StairShape): string {
  const radius = shape.flight / 2
  const newel = Math.max(60, radius * 0.16)
  const treads = shape.risers - 1
  // A full turn and a bit is what a spiral in a house does; more than that and
  // the treads are too narrow to stand on.
  const sweep = Math.min(Math.PI * 2.2, (Math.PI * 2 * treads) / 13)
  const each = sweep / treads

  const parts = [
    `<circle cx="${round(radius)}" cy="${round(radius)}" r="${round(radius - 7)}" fill="#ffffff" stroke="${LINE}" stroke-width="14"/>`,
  ]
  for (let index = 0; index <= treads; index += 1) {
    // From the foot, which is drawn at the bottom the way every other flight is.
    const angle = Math.PI / 2 + index * each
    const from = {
      x: radius + Math.cos(angle) * newel,
      y: radius + Math.sin(angle) * newel,
    }
    const to = {
      x: radius + Math.cos(angle) * (radius - 7),
      y: radius + Math.sin(angle) * (radius - 7),
    }
    parts.push(
      `<path d="M ${round(from.x)} ${round(from.y)} L ${round(to.x)} ${round(to.y)}" stroke="${LINE}" stroke-width="14" fill="none"/>`,
    )
  }
  parts.push(
    `<circle cx="${round(radius)}" cy="${round(radius)}" r="${round(newel)}" fill="#ffffff" stroke="${LINE}" stroke-width="14"/>`,
  )
  return parts.join('')
}
