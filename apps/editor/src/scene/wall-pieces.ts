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

    pieces.push(...swingOf(opening, hole, line, wall))
  })

  return pieces
}

/**
 * A door drawn open: the leaf standing square to the wall, and the quarter it
 * sweeps shown as a dashed arc back to the far jamb. The dashes are short boxes
 * laid along the arc rather than a dashed line, so they scale with the drawing
 * like every other line here.
 *
 * The whole swing hangs off the wall's face, not its centre line. A leaf pinned
 * to the centre line would have half its root buried in the wall and its arc
 * would close into the middle of the masonry instead of onto the jamb.
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

  const pieces: WallPiece[] = [
    {
      key: `${opening.id}-leaf`,
      colour: INK.outline,
      at: stile,
      aside: swing * (width / 2 - face),
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
      aside: swing * (width / 2 - face),
      turn: QUARTER,
      length: width - 2 * line,
      thickness: leaf - 2 * line,
      base: 6,
      height,
    },
  ]

  // The swing runs between the corner of the open leaf that faces the opening and
  // the near face of the far jamb — the two points a reader's eye goes to. They
  // are not the same distance from the hinge, so the quarter is an ellipse, not a
  // circle; a circle would have to miss one of them. Both semi-axes come in by
  // half a line so it is the drawn edge that lands on the corners rather than the
  // middle of the line straddling them.
  const reach = width - leaf - line / 2
  const rise = width - 2 * face - line / 2
  const step = QUARTER / (2 * DASHES - 1)

  for (let i = 0; i < DASHES; i += 1) {
    const angle = (2 * i + 0.5) * step
    const run = reach * Math.cos(angle)
    const drop = rise * Math.sin(angle)
    pieces.push({
      key: `${opening.id}-arc-${i}`,
      colour: INK.outline,
      at: hinge + towards * (leaf + reach * Math.sin(angle)),
      aside: swing * (face + rise * Math.cos(angle)),
      turn: Math.atan2(-swing * drop, towards * run),
      length: step * Math.hypot(run, drop),
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
