import type { Opening, Wall } from '@houseit/core/document'
import { freeSpans, type Span, spanAround } from '@houseit/geometry/spans'

/**
 * Ink, sampled from a the reference plan: walls are a grey fill inside a near-black
 * outline, and an opening is white with one thin line down the middle of it.
 */
export const INK = {
  outline: '#212121',
  wall: '#424242',
  glass: '#ffffff',
  perspective: '#e7e5e4',
} as const

/** A drawn line weight, in millimetres, scaled off the wall it belongs to. */
export const lineWeight = (thickness: number) => Math.max(15, Math.round(thickness / 8))

export type WallPiece = {
  key: string
  colour: string
  /** Middle of the piece along the wall, in millimetres from the extended start. */
  at: number
  length: number
  thickness: number
  /**
   * Bottom of the piece above the wall's base, and how tall it is.
   *
   * In the plan these only decide what covers what: the drawing is seen from
   * straight overhead, so a piece raised a couple of millimetres simply hides
   * the one below it. That is how the fill sits inside the outline and the pane
   * line on top of the glass — no render order needed. In perspective they are
   * what they say, and are what leaves a sill under a window and a head over it.
   */
  base: number
  height: number
  /** Sideways off the wall's centre line, positive a quarter turn counter-clockwise. */
  aside?: number
  /** Rotation on top of the wall's own, in the same sense as `aside`. */
  turn?: number
  /** The door or window this piece draws, so it can be picked and dragged. */
  opening?: string
  /** Not drawn at all: there only to be clicked, where the drawing is a gap. */
  hidden?: boolean
}

/** How many dashes draw a door's swing, and the quarter turn they cover. */
const DASHES = 7
const QUARTER = Math.PI / 2

/**
 * The boxes that draw one wall in the plan, in three layers.
 *
 * The bottom layer is the wall's whole silhouette at full thickness, openings
 * included. Everything after it is inset by one line weight, so what is left
 * showing at the faces is the outline. Solid stretches are filled grey, openings
 * white, and each opening gets a line down its middle for the glazing.
 */
export function planPieces(
  wall: Wall,
  openings: Opening[],
  length: number,
  growA: number,
  span: number,
): WallPiece[] {
  const line = lineWeight(wall.thickness)
  const inner = wall.thickness - 2 * line
  const holes = openings.map((opening) => spanAround(growA + opening.t * span, opening.width))
  // A doorway is a gap in the drawing, not a hole filled in with white. Both rooms
  // run their floor to the middle of the wall, so leaving the gap empty is what
  // puts half of each room's floor in the opening — which is what a doorway looks
  // like. A window is different: it keeps the wall drawn across it, with its own
  // white and its pane line laid over the top.
  const doorways = openings.flatMap((opening, index) =>
    opening.kind === 'door' ? [holes[index]!] : [],
  )

  const pieces: WallPiece[] = freeSpans(length, doorways).map((solid) => ({
    key: `outline-${solid.from}`,
    colour: INK.outline,
    at: middleOf(solid),
    length: solid.to - solid.from,
    thickness: wall.thickness,
    base: 0,
    height: wall.height,
  }))

  for (const solid of freeSpans(length, holes)) {
    pieces.push({
      key: `fill-${solid.from}`,
      colour: INK.wall,
      at: middleOf(solid),
      length: solid.to - solid.from,
      thickness: inner,
      base: 2,
      height: wall.height,
    })
  }

  openings.forEach((opening, index) => {
    const hole = holes[index]!
    const before = pieces.length
    drawOpening(opening, hole, line, inner, wall, pieces)
    for (const piece of pieces.slice(before)) piece.opening = opening.id
  })

  return pieces
}

/** The pieces of one opening, pushed onto the wall's. */
function drawOpening(
  opening: Opening,
  hole: Span,
  line: number,
  inner: number,
  wall: Wall,
  pieces: WallPiece[],
): void {
  if (opening.kind === 'window') {
    pieces.push(
      {
        key: `${opening.id}-glass`,
        colour: INK.glass,
        at: middleOf(hole),
        length: opening.width,
        thickness: inner,
        base: 2,
        height: wall.height,
      },
      {
        key: `${opening.id}-pane`,
        colour: INK.outline,
        at: middleOf(hole),
        length: opening.width,
        thickness: line,
        base: 4,
        height: wall.height,
      },
    )
    return
  }

  if (opening.variant === 'garage') {
    pieces.push(...garageOf(opening, hole, line, wall))
    return
  }
  if (opening.variant === 'sliding' || opening.variant === 'pocket') {
    pieces.push(...slidingOf(opening, hole, line, wall))
    return
  }
  pieces.push(...swingOf(opening, hole, line, wall))
  // A doorway is drawn as a gap, and a gap cannot be clicked. What takes the
  // click is a box filling the opening that is never seen.
  pieces.push({
    key: `${opening.id}-pick`,
    colour: INK.glass,
    at: middleOf(hole),
    length: opening.width,
    thickness: wall.thickness,
    base: 0,
    height: wall.height,
    hidden: true,
  })
}

/**
 * A garage door: the opening drawn closed, as a white panel filling the wall
 * with one line along its middle — the way the reference draws it, and the way a
 * sectional door reads from above, since it is never open in a plan.
 */
function garageOf(opening: Opening, hole: Span, line: number, wall: Wall): WallPiece[] {
  const inner = wall.thickness - 2 * line
  return [
    {
      key: `${opening.id}-panel`,
      colour: INK.glass,
      at: middleOf(hole),
      length: opening.width,
      thickness: inner,
      base: 2,
      height: wall.height,
    },
    {
      key: `${opening.id}-line`,
      colour: INK.outline,
      at: middleOf(hole),
      length: opening.width,
      thickness: line,
      base: 4,
      height: wall.height,
    },
  ]
}

/**
 * A sliding door: two panels, each half the opening, lapped past one another so
 * the plan shows them as the two leaves they are. A pocket door is the same
 * drawing with one leaf, and its other half run back into the wall it hides in.
 */
function slidingOf(opening: Opening, hole: Span, line: number, wall: Wall): WallPiece[] {
  const width = opening.width
  const leaf = Math.max(line * 2, wall.thickness / 3)
  const pocket = opening.variant === 'pocket'
  // A sliding pair splits the opening; a pocket leaf covers it when closed and is
  // drawn half out of the wall, the rest of it inside.
  const panel = pocket ? width : width / 2 + line
  const towards = opening.hinge === 'a' ? 1 : -1
  const first = pocket ? hole.from + width * 0.5 : hole.from + panel / 2
  const second = pocket ? hole.from - width * 0.5 : hole.to - panel / 2

  const panels: WallPiece[] = [
    { key: 'near', at: first, aside: -leaf / 2 },
    { key: 'far', at: second, aside: leaf / 2 },
  ].flatMap(({ key, at, aside }) => [
    {
      key: `${opening.id}-${key}`,
      colour: INK.outline,
      at: at * 1 + 0 * towards,
      aside,
      length: panel,
      thickness: leaf,
      base: 4,
      height: wall.height,
    },
    {
      key: `${opening.id}-${key}-fill`,
      colour: INK.glass,
      at,
      aside,
      length: panel - 2 * line,
      thickness: Math.max(1, leaf - 2 * line),
      base: 6,
      height: wall.height,
    },
  ])

  return pocket ? panels.slice(0, 2) : panels
}

/**
 * A door drawn open: the leaf standing square to the wall, and the quarter it
 * sweeps shown as a dashed arc back to the far jamb. The dashes are short boxes
 * laid along the arc rather than a dashed line, so they scale with the drawing
 * like every other line here.
 *
 * The whole swing hangs off the face of the wall, not its centre line and not
 * the face on the other side. A leaf that starts anywhere inside the masonry is
 * a leaf that ends short of the far jamb by whatever it lost in there — the
 * drawing of a door too small for the hole it hangs in, which is exactly how it
 * reads. Off the near face, the leaf's tip and the far jamb are both one door's
 * width from the hinge, and the quarter between them is a circle.
 */
function swingOf(opening: Opening, hole: Span, line: number, wall: Wall): WallPiece[] {
  const width = opening.width
  const swing = opening.swing
  const height = wall.height
  const face = wall.thickness / 2
  const hinge = opening.hinge === 'a' ? hole.from : hole.to
  // Which way along the wall the door closes, away from the end it hangs on.
  const towards = opening.hinge === 'a' ? 1 : -1
  // Drawn as thick as half the wall it hangs in, the way the reference draws a leaf.
  const leaf = wall.thickness / 2
  // The leaf stands inside the opening with its outer face in the jamb, which is
  // also where the arc is centred — so the swing springs off the edge of the open
  // door rather than out of the middle of it.
  const stile = hinge + (towards * leaf) / 2
  // The leaf stands wholly in the room: its root on the face the door swings off
  // and its tip a full width in from there.
  const stands = swing * (width / 2 + face)

  const pieces: WallPiece[] = [
    {
      key: `${opening.id}-leaf`,
      colour: INK.outline,
      at: stile,
      aside: stands,
      turn: QUARTER,
      length: width,
      thickness: leaf,
      base: 4,
      height,
    },
    {
      key: `${opening.id}-leaf-fill`,
      colour: INK.glass,
      at: stile,
      aside: stands,
      turn: QUARTER,
      length: width - 2 * line,
      thickness: leaf - 2 * line,
      base: 6,
      height,
    },
  ]

  // A door sweeps a circle its own width about the hinge, which is what the plan
  // checks a door against and what the reference draws: the tip of the open leaf and the
  // near face of the far jamb are both that far away, so one radius reaches both.
  // It comes in by half a line, so it is the drawn edge that lands on them rather
  // than the middle of the line straddling them.
  const radius = width - line / 2
  const step = QUARTER / (2 * DASHES - 1)

  for (let i = 0; i < DASHES; i += 1) {
    const angle = (2 * i + 0.5) * step
    const run = radius * Math.cos(angle)
    const drop = radius * Math.sin(angle)
    pieces.push({
      key: `${opening.id}-arc-${i}`,
      colour: INK.outline,
      at: hinge + towards * drop,
      aside: swing * (face + run),
      turn: Math.atan2(-swing * drop, towards * run),
      length: step * radius,
      thickness: line,
      base: 4,
      height,
    })
  }

  return pieces
}

/**
 * In perspective there is no drawing to imitate: just the wall, with holes in it.
 *
 * The holes are only as tall as the openings themselves. Cut them full height and
 * every window reads as a doorway.
 */
export function solidPieces(
  wall: Wall,
  openings: Opening[],
  length: number,
  growA: number,
  span: number,
): WallPiece[] {
  const holes = openings.map((opening) => spanAround(growA + opening.t * span, opening.width))

  const pieces: WallPiece[] = freeSpans(length, holes).map((solid) => ({
    key: `solid-${solid.from}`,
    colour: INK.perspective,
    at: middleOf(solid),
    length: solid.to - solid.from,
    thickness: wall.thickness,
    base: 0,
    height: wall.height,
  }))

  openings.forEach((opening, index) => {
    const head = opening.sillHeight + opening.height
    const spans = [
      { name: 'sill', base: 0, height: opening.sillHeight },
      { name: 'head', base: head, height: wall.height - head },
    ]

    for (const part of spans) {
      if (part.height <= 0) continue
      pieces.push({
        key: `${opening.id}-${part.name}`,
        colour: INK.perspective,
        at: middleOf(holes[index]!),
        length: opening.width,
        thickness: wall.thickness,
        base: part.base,
        height: part.height,
      })
    }
  })

  return pieces
}

const middleOf = (span: Span) => (span.from + span.to) / 2
