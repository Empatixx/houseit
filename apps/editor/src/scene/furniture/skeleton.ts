import type { HouseObject } from '@houseit/core/document'

/**
 * The shape of a thing, and nothing else about it.
 *
 * No colours here on purpose. A skeleton is the form — a top, a seat, a curved
 * back — and what fills it comes from the surface the object was given. One table
 * is oak, walnut, marble or glass without there being four tables, and a new wood
 * costs a row in `surfaces.ts` rather than anything here.
 *
 * It carries heights as well as a footprint, so the same skeleton draws the plan
 * and builds the model: flat shapes seen from overhead, the very same shapes
 * pushed up to `height` when the camera moves. That is why a table has legs here
 * even though a plan never shows them.
 *
 * Local millimetres, origin at the middle, `+y` the way the thing faces.
 */
export type Part = {
  key: string
  kind: 'rect' | 'disc' | 'band'
  x: number
  y: number
  width: number
  depth: number
  /**
   * Corner rounding on a rect: one number for all four, or a corner at a time.
   *
   * Named from the thing's own front. Pieces that butt together are rounded on
   * the outside and square where they meet, which is what lets an arm sit against
   * a cushion without a notch opening up between them.
   */
  radius?: number | Corners
  /**
   * Corners cut off straight rather than curved, which turns a rectangle into a
   * polygon. What the electronics behind a television's display look like from
   * above, and the one thing that keeps them from reading as another rectangle.
   */
  bevel?: boolean
  /** How thick the wall of a band is. */
  wall?: number
  /** Ribs across a chair's back, drawn in the plan only. */
  spokes?: number
  /** Turn about its own middle, in the plan's own sense. */
  turn?: number
  /** Higher covers lower, which is all a drawing seen from overhead needs. */
  lift: number
  /** Millimetres above the floor, and how tall. Only the model reads these. */
  base: number
  height: number
  /** Where the part belongs: legs are model only, ribs are a plan convention. */
  show?: 'both' | 'plan' | 'model'
  /** Drawn filled, or as a line. The colours still come from the surface. */
  paint?: 'fill' | 'line'
  /**
   * Lit from one side and shaded on the other, inside its own outline.
   *
   * Upholstery only. A table top is a flat board and reads as one; a cushion is
   * stuffed, and the band of light along one edge is most of what says so.
   */
  relief?: boolean
  /**
   * A shade off the object's own surface. Still no colours here — the part asks
   * to be darker or lighter, and what that means is the surface's business. It is
   * what keeps chairs readable against the table they are tucked under, and a
   * cushion readable against the sofa it is thrown on.
   */
  tone?: 'plain' | 'dark' | 'light'
  /**
   * The surface's colour without its pattern.
   *
   * Bedding is smooth. A weave printed at a third of a metre across a duvet is
   * not linen seen from three metres up, it is noise — and the same is true of
   * anything soft and plain. The colour still comes from the surface.
   */
  plain?: boolean
  /**
   * A finish of this part's own, named from `surfaces.ts`, for the parts that are
   * not made of whatever the object is: the basin sunk in a walnut vanity is
   * ceramic, and a walnut one is not a thing. Still no colour here — only the
   * name of a finish, which `surfaces.ts` is left to answer for.
   */
  surface?: string
}

/** Front-left, front-right, back-right, back-left, in the thing's own frame. */
export type Corners = { fl?: number; fr?: number; br?: number; bl?: number }

const QUARTER = Math.PI / 2

/**
 * Four legs under the corners of whatever they hold up, which only the model
 * sees. `cy` is where that thing sits: legs measured from the middle of the
 * object rather than from the middle of the seat leave a chair standing beside
 * its own legs.
 */
function legs(width: number, depth: number, top: number, at: string, cy = 0): Part[] {
  const size = 55
  const inset = 70
  return [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([sx, sy], index) => ({
    key: `${at}leg-${index}`,
    kind: 'rect' as const,
    x: (sx ?? 1) * (width / 2 - inset),
    y: cy + (sy ?? 1) * (depth / 2 - inset),
    width: size,
    depth: size,
    lift: 0,
    base: 0,
    height: top,
    show: 'model' as const,
  }))
}

/**
 * A chair seen from above: a rounded seat with a curved back behind it and the
 * spindles between them.
 *
 * The back is a band rather than a filled half-disc. A filled one reads as a
 * shell in the plan, and in the model it comes out a solid block instead of
 * something you could sit against.
 */
function chair(width: number, depth: number, at = '', tone: Part['tone'] = 'plain'): Part[] {
  const height = 440
  const thick = 45
  const seat = { width: width * 0.88, depth: depth * 0.52, y: depth * 0.16 }
  // The back stands at the rear edge of the seat and bows only a little. Bowed by
  // half its own width it comes out a barrel in the model and a shell in the plan.
  const back = { y: seat.y - seat.depth / 2 + 20, bow: depth * 0.22 }

  return [
    {
      key: `${at}back`,
      kind: 'band',
      x: 0,
      y: back.y,
      width,
      depth: back.bow,
      wall: 45,
      spokes: 5,
      lift: 4,
      base: height + thick,
      height: 400,
      paint: 'line',
      tone,
    },
    {
      key: `${at}seat`,
      kind: 'rect',
      x: 0,
      y: seat.y,
      width: seat.width,
      depth: seat.depth,
      radius: depth * 0.16,
      lift: 2,
      base: height,
      height: thick,
      tone,
    },
    ...legs(seat.width, seat.depth, height, at, seat.y).map((leg) => ({ ...leg, tone })),
  ]
}

/** Chairs set round a table, tucked far enough under it that the top overlaps them. */
function seating(width: number, depth: number, seats: number): Part[] {
  const size = { width: 460, depth: 500 }
  const tuck = -70
  const ends = seats >= 4 ? 2 : 0
  const perSide = Math.max(0, Math.round((seats - ends) / 2))
  const parts: Part[] = []

  const place = (index: number, x: number, y: number, turn: number) =>
    // A shade darker than the top, so a chair tucked under a table still reads.
    chair(size.width, size.depth, `chair-${index}-`, 'dark').map((part) => ({
      ...part,
      x: x + part.x * Math.cos(turn) - part.y * Math.sin(turn),
      y: y + part.x * Math.sin(turn) + part.y * Math.cos(turn),
      turn,
    }))

  const offset = depth / 2 + tuck + size.depth / 2
  for (let i = 0; i < perSide; i += 1) {
    const step = width / perSide
    const x = -width / 2 + step * (i + 0.5)
    parts.push(...place(parts.length, x, offset, Math.PI))
    parts.push(...place(parts.length, x, -offset, 0))
  }
  if (ends === 2) {
    const reach = width / 2 + tuck + size.depth / 2
    parts.push(...place(parts.length, reach, 0, QUARTER))
    parts.push(...place(parts.length, -reach, 0, -QUARTER))
  }
  return parts
}

/**
 * Upholstery seen from above: a body with a back along it, an arm at each end and
 * a cushion for every place.
 *
 * The cushions are what make it read as seating rather than as a rounded box, and
 * why they are counted rather than assumed: a two-seater and a four-seater are
 * the same shape and a different piece of furniture.
 */
function upholstered(width: number, depth: number, seats: number): Part[] {
  const seat = 420
  const arm = Math.min(210, width * 0.17)
  const back = Math.min(260, depth * 0.3)
  const front = depth - back
  const inner = width - arm * 2
  const places = Math.max(1, seats)
  const step = inner / places
  const forward = back / 2
  // The seat goes down first and the frame closes over it: each cushion laps the
  // one before, the arms lap the row of them, the back laps the arms. Every seam
  // is one piece's own edge showing where it covers the piece below, which is the
  // only way a plan tells three cushions from one long bench.
  const over = 120
  const pill = (across: number, deep: number) => Math.min(across, deep) / 2
  // Arms and back are whole pills. A cushion is not: rounded right off it stops
  // reading as something you sit on.
  const cushion = 140
  const frame = places + 1

  const parts: Part[] = [
    {
      key: 'arm-west',
      kind: 'rect',
      x: -(width - arm) / 2,
      y: 0,
      width: arm,
      depth,
      radius: pill(arm, depth),
      lift: frame,
      base: seat,
      height: 230,
      tone: 'dark',
      relief: true,
    },
    {
      key: 'arm-east',
      kind: 'rect',
      x: (width - arm) / 2,
      y: 0,
      width: arm,
      depth,
      radius: pill(arm, depth),
      lift: frame,
      base: seat,
      height: 230,
      tone: 'dark',
      relief: true,
    },
    {
      key: 'back',
      kind: 'rect',
      x: 0,
      y: -(depth - back) / 2,
      width,
      depth: back,
      radius: pill(width, back),
      lift: frame + 1,
      base: seat,
      height: 400,
      tone: 'dark',
      relief: true,
    },
  ]

  for (let i = 0; i < places; i += 1) {
    parts.push({
      key: `cushion-${i}`,
      kind: 'rect',
      x: -inner / 2 + step * (i + 0.5),
      // Deeper than the seat it fills, and only backwards: the extra runs under
      // the back, while the front edge stays flush with the front of the sofa.
      y: forward - over / 2,
      width: step + over,
      depth: front + over,
      radius: cushion,
      lift: 1 + i,
      base: seat,
      height: 130,
      relief: true,
    })
  }

  parts.push({
    key: 'pillow',
    kind: 'rect',
    x: -inner / 2 + step * 0.5,
    y: forward - 30,
    width: Math.min(330, step * 0.55),
    depth: Math.min(310, front * 0.44),
    radius: cushion * 0.7,
    turn: 0.42,
    lift: frame + 2,
    base: seat + 130,
    height: 90,
    tone: 'light',
    relief: true,
  })

  return parts
}

/**
 * A rug: a woven field with its fringe showing at the two ends.
 *
 * The fringe is what tells a rug from a coloured rectangle on a plan, so it is
 * drawn rather than implied — short strokes standing off the two opposite edges,
 * the way the warp is left hanging when the weaving stops.
 *
 * It lies below everything: a rug is what furniture stands on, and drawing it
 * over a table would put the table under the carpet.
 */
function rug(width: number, depth: number): Part[] {
  // Warp hangs off the ends a rug was woven from, which are its short sides —
  // whichever way round it happens to be lying.
  const ends = width <= depth ? 'across' : 'along'
  const span = ends === 'across' ? width : depth
  const reach = ends === 'across' ? depth : width

  // The fringe hangs off the ends, as fringe does, so a rug covers a little more
  // floor than the size it is asked for. The catalogue says how much in `reach`,
  // and that is what the placement check measures.
  const tassel = { long: Math.min(110, Math.min(width, depth) * 0.1), across: 26 }
  // Spread so the outer edge of the first and last strands lands on the rug's own
  // edge. Centred on the edge instead, half of each end strand hangs off the side
  // and the fringe comes out wider than the rug it belongs to.
  const run = span - tassel.across
  const count = Math.max(3, Math.round(run / 95) + 1)
  const step = run / (count - 1)

  const fringe: Part[] = []
  for (const end of [1, -1]) {
    for (let i = 0; i < count; i += 1) {
      const along = -run / 2 + step * i
      const off = end * (reach / 2 + tassel.long / 2)
      fringe.push({
        key: `fringe-${end}-${i}`,
        kind: 'rect',
        x: ends === 'across' ? along : off,
        y: ends === 'across' ? off : along,
        width: tassel.across,
        depth: tassel.long,
        turn: ends === 'across' ? 0 : Math.PI / 2,
        lift: 0,
        base: 0,
        height: 8,
        paint: 'line',
      })
    }
  }

  return [
    {
      key: 'field',
      kind: 'rect',
      x: 0,
      y: 0,
      width,
      depth,
      lift: 1,
      base: 0,
      height: 12,
    },
    ...fringe,
  ]
}

/**
 * A plant seen from above: leaves thrown out from a pot.
 *
 * Drawn from the middle out, which is what makes it read as a plant at 1:100 and
 * not as a green circle. Every leaf is a little off — longer, shorter, turned a
 * few degrees — because a plant drawn on a perfect star reads as a logo. The
 * wobble comes from the object's own id, so a given plant looks the same every
 * time it is drawn and different from the one across the room.
 */
function plant(width: number, depth: number, seed: string): Part[] {
  const size = Math.min(width, depth)
  const wobble = scatter(seed)
  const leaves = 6 + Math.floor(wobble(0) * 3)
  const pot = size * 0.4

  const fronds: Part[] = []
  for (let i = 0; i < leaves; i += 1) {
    const turn = (i / leaves) * Math.PI * 2 + (wobble(i * 3 + 1) - 0.5) * 0.5
    const reach = size * (0.24 + wobble(i * 3 + 2) * 0.06)
    const long = size * (0.36 + wobble(i * 3 + 3) * 0.18)
    const across = size * (0.14 + wobble(i * 3 + 4) * 0.06)

    fronds.push({
      key: `leaf-${i}`,
      kind: 'rect',
      x: -Math.sin(turn) * reach,
      y: Math.cos(turn) * reach,
      width: across,
      depth: long,
      radius: across / 2,
      turn,
      lift: 2,
      base: 340,
      height: 30,
    })
  }

  return [
    {
      key: 'pot',
      kind: 'disc',
      x: 0,
      y: 0,
      width: pot,
      depth: pot,
      lift: 0,
      base: 0,
      height: 340,
      tone: 'dark',
    },
    ...fronds,
    {
      key: 'crown',
      kind: 'disc',
      x: 0,
      y: 0,
      width: pot * 0.42,
      depth: pot * 0.42,
      lift: 4,
      base: 370,
      height: 20,
      tone: 'dark',
    },
  ]
}

/**
 * Numbers between 0 and 1 that are always the same for the same name, so a plant
 * keeps its own shape across a reload rather than shuffling on every draw.
 */
function scatter(seed: string) {
  let base = 0x811c9dc5
  for (const character of seed) {
    base = Math.imul(base ^ character.charCodeAt(0), 0x01000193)
  }
  return (index: number) => {
    let value = Math.imul(base ^ index, 0x9e3779b1)
    value = Math.imul(value ^ (value >>> 15), 0x85ebca6b)
    return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff
  }
}

/** A round table stands on one foot rather than four legs, which the model sees. */
function pedestal(across: number): Part[] {
  return [
    {
      key: 'foot',
      kind: 'disc',
      x: 0,
      y: 0,
      width: across * 0.4,
      depth: across * 0.4,
      lift: 0,
      base: 0,
      height: 60,
      show: 'model',
    },
    {
      key: 'stem',
      kind: 'disc',
      x: 0,
      y: 0,
      width: across * 0.14,
      depth: across * 0.14,
      lift: 0,
      base: 60,
      height: TOP - 60,
      show: 'model',
    },
  ]
}

/** Chairs set round a circle, each turned to face the middle of it. */
function seatingRound(across: number, seats: number): Part[] {
  const size = { width: 460, depth: 500 }
  const tuck = -70
  const reach = across / 2 + tuck + size.depth / 2
  const parts: Part[] = []

  for (let i = 0; i < seats; i += 1) {
    const angle = (i / seats) * Math.PI * 2
    const at = { x: -Math.sin(angle) * reach, y: Math.cos(angle) * reach }
    // Half a turn on from facing outwards, which is what puts its back to the room.
    const turn = angle + Math.PI

    parts.push(
      ...chair(size.width, size.depth, `chair-${i}-`, 'dark').map((part) => ({
        ...part,
        x: at.x + part.x * Math.cos(turn) - part.y * Math.sin(turn),
        y: at.y + part.x * Math.sin(turn) + part.y * Math.cos(turn),
        turn,
      })),
    )
  }
  return parts
}

/**
 * A bedside table: a small top with the line of its drawer showing.
 *
 * The drawer is the whole of what tells it from any other small box seen from
 * above, so it is drawn rather than left to the label.
 */
function bedside(width: number, depth: number): Part[] {
  const height = 480
  return [
    {
      key: 'top',
      kind: 'rect',
      x: 0,
      y: 0,
      width,
      depth,
      radius: 40,
      lift: 2,
      base: height,
      height: 38,
    },
    {
      key: 'drawer',
      kind: 'rect',
      x: 0,
      y: -depth * 0.16,
      width: width * 0.74,
      depth: 20,
      lift: 4,
      base: height + 38,
      height: 4,
      paint: 'line',
      show: 'plan',
    },
    ...legs(width * 0.82, depth * 0.78, height, ''),
  ]
}

/**
 * A run of units seen from above: the top, and a handle for every door under it.
 *
 * The top on its own is a rectangle and could be anything. What makes it a run of
 * cupboards is the handles: one to a door, halfway along it, standing off the
 * front edge — because from straight above the top covers the door and everything
 * on it, and the reaching-out part is all there is to see. A line drawn across the
 * top instead of handles was tried, and at plan scale it reads as a scratch.
 */
function units(width: number, depth: number, height: number, door: number): Part[] {
  const doors = Math.max(1, Math.round(width / door))
  const run = width / doors
  // The top stops short of the footprint. What fills the rest is the handles, and
  // they are the reason the footprint is deeper than the units.
  const stub = 44
  const top = { depth: depth - stub, front: depth / 2 - stub }
  const handle = { width: Math.min(run * 0.42, 300), depth: 30 }

  const parts: Part[] = [
    {
      key: 'top',
      kind: 'rect',
      x: 0,
      y: -stub / 2,
      width,
      depth: top.depth,
      radius: 8,
      lift: 2,
      base: height - 40,
      height: 40,
    },
  ]

  for (let i = 0; i < doors; i += 1) {
    parts.push({
      key: `handle-${i}`,
      kind: 'rect',
      x: -width / 2 + run * (i + 0.5),
      y: top.front,
      width: handle.width,
      depth: handle.depth,
      radius: handle.depth / 2,
      lift: 4,
      base: height - 200,
      height: 30,
      tone: 'dark',
    })
  }

  return parts
}

/**
 * A television console: a low run of units, with wider doors than a kitchen has —
 * it is a longer, lower thing, and a metre-and-a-half of it is two doors, not
 * three.
 */
function sideboard(width: number, depth: number): Part[] {
  const height = 420
  return [
    ...units(width, depth, height, 800).map((part) =>
      part.key === 'top'
        ? {
            ...part,
            // Lifted a shade, which only tells when the cabinet is black as well: a
            // black television on a black cabinet is one shape. Wood and marble
            // carry their own colour in the texture, and this leaves those alone.
            tone: 'light' as const,
          }
        : part,
    ),
    ...legs(width * 0.9, depth * 0.8, height - 40, ''),
  ]
}

/**
 * A television seen from straight above: a wide bar for the screen, backed onto
 * the wall, and the foot it stands on reaching into the room in front of it.
 *
 * Which is nearly all a television is from up here — edge-on, a screen is a line.
 * It is drawn at the height of a console top rather than on the floor, because
 * that is where a television lives whether or not one has been put under it.
 */
function television(width: number, depth: number): Part[] {
  const stands = 460
  // Standing off the wall rather than against it, so a sliver of whatever it is
  // on shows behind and the display is not read as part of the wall itself.
  const gap = 50
  const back = -depth / 2 + gap
  // Everything is arranged about one line: the display sits on it, the electronics
  // reach back to it, and the stand is centred on it. The box behind is no deeper
  // than it has to be — a deep one reads as a cupboard rather than a television.
  const box = 80
  const middle = back + box
  const panel = 46
  const cross = { span: 200, bar: 50 }

  return [
    {
      // Where the electronics are: not a rectangle, and square along the edge it
      // shares with the display, so the two lie against one another.
      key: 'housing',
      kind: 'rect',
      x: 0,
      y: back + box / 2,
      width: Math.min(width * 0.54, 820),
      depth: box,
      radius: { bl: 46, br: 46 },
      bevel: true,
      lift: 2,
      base: stands + 40,
      height: Math.round(width * 0.4),
    },
    // The stand as it is seen from straight above: a little cross on the same
    // middle as the display, turned onto its corner and drawn under everything
    // else, so all that shows of it is the four legs coming out from behind.
    {
      key: 'foot-across',
      kind: 'rect',
      x: 0,
      y: middle,
      width: cross.span,
      depth: cross.bar,
      radius: cross.bar / 2,
      turn: Math.PI / 4,
      lift: 1,
      base: stands,
      height: 40,
      tone: 'dark',
    },
    {
      key: 'foot-along',
      kind: 'rect',
      x: 0,
      y: middle,
      width: cross.bar,
      depth: cross.span,
      radius: cross.bar / 2,
      turn: Math.PI / 4,
      lift: 1,
      base: stands,
      height: 40,
      tone: 'dark',
    },
    {
      key: 'display',
      kind: 'rect',
      x: 0,
      y: middle,
      width,
      depth: panel,
      radius: { fl: 14, fr: 14 },
      lift: 6,
      base: stands + 40,
      height: Math.round(width * 0.56),
    },
  ]
}

/**
 * A toilet from straight above: the cistern against the wall and the bowl in front
 * of it, with the seat drawn inside.
 *
 * The bowl is an egg rather than an ellipse. Rounded the same all round it reads
 * as a basin; what says toilet is the front being a half-circle and the back,
 * where it meets the cistern, being nearly square.
 */
function toilet(width: number, depth: number): Part[] {
  const height = 400
  const tank = { depth: depth * 0.26, height: 400 }
  const face = -depth / 2 + tank.depth
  // The bowl runs back under the cistern rather than up against it. Two shapes
  // whose edges meet exactly read as two shapes; lapped, they read as a toilet.
  const under = tank.depth * 0.7
  const bowl = { width: width * 0.94, back: face - under, front: depth / 2 }
  const seat = { width: width * 0.94 - 110, back: face + 40, front: depth / 2 - 45 }
  const button = { width: width * 0.22, depth: tank.depth * 0.34 }
  const egg = (across: number, round: number) => ({
    fl: across / 2,
    fr: across / 2,
    bl: round,
    br: round,
  })
  const span = (from: number, to: number) => ({ y: (from + to) / 2, depth: to - from })

  return [
    {
      key: 'bowl',
      kind: 'rect',
      x: 0,
      ...span(bowl.back, bowl.front),
      width: bowl.width,
      // An egg: a half-circle at the front, and squarer at the back where the
      // cistern comes down over it.
      radius: egg(bowl.width, Math.round(bowl.width * 0.3)),
      lift: 2,
      base: 0,
      height,
    },
    {
      // The seat, as a plan draws it: the same egg one line in, filled in the same
      // white, so what shows of it is the edge it carries.
      key: 'seat',
      kind: 'rect',
      x: 0,
      ...span(seat.back, seat.front),
      width: seat.width,
      radius: egg(seat.width, Math.round(bowl.width * 0.24)),
      lift: 4,
      base: height,
      height: 40,
      show: 'plan',
    },
    {
      key: 'cistern',
      kind: 'rect',
      x: 0,
      ...span(-depth / 2, face),
      width,
      radius: 30,
      lift: 6,
      base: height,
      height: tank.height,
    },
    {
      key: 'button',
      kind: 'rect',
      x: 0,
      ...span(-depth / 2, face),
      width: button.width,
      depth: button.depth,
      radius: button.depth / 2,
      lift: 8,
      base: height + tank.height,
      height: 6,
      tone: 'dark',
    },
  ]
}

/**
 * A waste bin: a round tub with its mouth drawn inside it.
 *
 * Two circles and nothing else. From straight above that is all a bin is, and the
 * inner one is what keeps it from reading as a stool.
 */
function bin(width: number, depth: number): Part[] {
  const height = 400
  return [
    {
      key: 'body',
      kind: 'disc',
      x: 0,
      y: 0,
      width,
      depth,
      lift: 2,
      base: 0,
      height,
      // Lifted off the black it is made of. Flat black reads as a hole in the
      // floor, and leaves the mouth inside it with nothing to show against.
      tone: 'light',
    },
    {
      key: 'mouth',
      kind: 'disc',
      x: 0,
      y: 0,
      width: width - 80,
      depth: depth - 80,
      lift: 4,
      base: height,
      height: 4,
      show: 'plan',
      // The same grey as the tub. The mouth is a line in a plan, not a dark hole:
      // filled darker it swallows the whole bin and leaves a black dot.
      tone: 'light',
    },
  ]
}

/**
 * A toilet roll on its holder, seen from straight above.
 *
 * Which means the roll shows its side, not its end. It is a cylinder hanging on a
 * spindle that runs along the wall, so from up here it is a rectangle with the
 * two arms holding it drawn as lines either side. Drawn as a circle it is a roll
 * standing on the floor, which is not where anybody keeps one.
 */
function toiletRoll(width: number, depth: number): Part[] {
  const height = 750
  const back = -depth / 2
  const plate = { width: width * 0.78, depth: 26 }
  const roll = { width: width * 0.55, back: back + plate.depth + 8, front: depth / 2 - 6 }
  const arm = { width: 14, reach: (width * 0.55) / 2 + 22 }

  // Each arm reaches from the wall to the middle of the roll, where the spindle
  // it turns on would be. Run on past it and the pair reads as a box round the
  // roll rather than as two brackets holding it.
  const middle = (roll.back + roll.front) / 2

  const bar = (side: -1 | 1): Part => ({
    key: side < 0 ? 'arm-west' : 'arm-east',
    kind: 'rect',
    x: side * arm.reach,
    y: (back + middle) / 2,
    width: arm.width,
    depth: middle - back,
    lift: 4,
    base: height,
    height: 20,
    paint: 'line',
    show: 'plan',
  })

  return [
    {
      key: 'plate',
      kind: 'rect',
      x: 0,
      y: back + plate.depth / 2,
      width: plate.width,
      depth: plate.depth,
      radius: 10,
      lift: 2,
      base: height,
      height: 60,
    },
    bar(-1),
    bar(1),
    {
      key: 'roll',
      kind: 'rect',
      x: 0,
      y: middle,
      width: roll.width,
      depth: roll.front - roll.back,
      radius: 16,
      lift: 6,
      base: height - 55,
      height: 110,
    },
    {
      // The rod it turns on, under the paper wound over it. What shows is the stub
      // at each end, between the roll and the arm holding it — which is what says
      // this is a holder and not a box on the wall.
      key: 'rod',
      kind: 'rect',
      x: 0,
      y: middle,
      width: arm.reach * 2,
      depth: 16,
      radius: 8,
      lift: 5,
      base: height,
      height: 16,
      paint: 'line',
      show: 'plan',
    },
  ]
}

/**
 * A basin, seen from above: the bowl sunk into whatever it is set in, and the tap
 * behind it against the wall.
 *
 * The bowl is drawn in the very same surface as the thing it is sunk into, and
 * what separates them is the edge each part carries. Giving it a colour of its own
 * would put ceramic in the skeleton, where no colour belongs — and it is not
 * needed: an oval line inside a top is what a plan means by a basin.
 */
function bowlAndTap(
  width: number,
  depth: number,
  sunk: number,
  top: number,
  lift: number,
  share: { across: number; deep: number },
  ware?: string,
): Part[] {
  const bowl = { width: width * share.across, depth: depth * share.deep }
  // Forward of the middle, which leaves the back clear for the tap behind it.
  const middle = depth * 0.08

  return [
    {
      key: 'bowl',
      kind: 'disc',
      x: 0,
      y: middle,
      width: bowl.width,
      depth: bowl.depth,
      lift,
      base: sunk,
      height: top - sunk,
      show: 'plan',
      ...(ware ? { surface: ware } : {}),
    },
    tap({ x: 0, y: middle - bowl.depth / 2 - KNOB }, top, lift + 1),
  ]
}

/**
 * The tap seen from straight above: a knob behind the bowl and nothing else.
 *
 * The spout reaches out over the bowl and is hidden by it, so what is left up here
 * is the top of the fitting where it comes through the surface. About fifty
 * millimetres across — any bigger and a basin turns into a bowl with a saucepan
 * behind it.
 */
function tap(at: { x: number; y: number }, base: number, lift: number): Part {
  const knob = 28
  return {
    key: 'tap',
    kind: 'disc',
    x: at.x,
    y: at.y,
    width: knob * 2,
    depth: knob * 2,
    lift,
    base,
    height: 180,
    tone: 'dark',
  }
}

/** How far off a bowl's edge the knob sits, so the two do not run together. */
const KNOB = 40

/**
 * A shower seen from straight above: the tray, the glass standing on it, and the
 * rose over the whole thing.
 *
 * Nearly all of it is honestly up there. The tray's floor points at the reader,
 * the rose points down at the tray so its back is what you see, and the glass is
 * edge-on — two lines and a bit, which is exactly what glass looks like from
 * overhead and most of what says this is a shower and not a tiled square.
 *
 * The way in is a gap. Drawn closed on every side it is a cupboard.
 */
function shower(width: number, depth: number): Part[] {
  const pane = 34
  const wall = -depth / 2
  // Glass returns along both ends, and part of the way across the front. What is
  // left of the front is the opening.
  const returns = depth * 0.62
  const front = width * 0.5
  // Close in to the wall it hangs off, and clear of the gully: overlapping it,
  // the two circles read as one fitting and nothing says which is which.
  const rose = { at: wall + 190, across: 220 }
  const inset = 10

  const glass = (key: string, over: Partial<Part>): Part => ({
    key,
    kind: 'rect',
    x: 0,
    y: 0,
    width: pane,
    depth: pane,
    // Square-ended: a rounded one reads as a bar laid on the floor rather than as
    // a sheet of glass standing on its edge.
    radius: 5,
    lift: 4,
    base: 60,
    height: 1950,
    surface: 'glass',
    ...over,
  })

  return [
    {
      key: 'tray',
      kind: 'rect',
      x: 0,
      y: 0,
      width,
      depth,
      radius: 40,
      lift: 0,
      base: 0,
      height: 60,
    },
    {
      key: 'waste',
      kind: 'disc',
      x: 0,
      y: 0,
      width: 100,
      depth: 100,
      lift: 2,
      base: 40,
      height: 10,
      tone: 'dark',
      show: 'plan',
    },
    {
      // The arm reaching out of the wall to the rose. Without it the rose is a
      // second circle lying on the tray, and nothing says which of the two is
      // over your head and which one the water goes down.
      key: 'arm',
      kind: 'rect',
      x: 0,
      y: (wall + rose.at) / 2,
      width: 46,
      depth: rose.at - wall,
      radius: 23,
      lift: 5,
      base: 2050,
      height: 30,
      tone: 'dark',
    },
    {
      // The rose, pointing down at the tray. What a plan gets of it is its back.
      key: 'rose',
      kind: 'disc',
      x: 0,
      y: rose.at,
      width: rose.across,
      depth: rose.across,
      lift: 6,
      base: 2050,
      height: 30,
      tone: 'dark',
    },
    // Standing on the tray, a hair inside its edge, so the tray's own line still
    // runs round the outside of the glass instead of under the middle of it.
    ...[-1, 1].map((side) =>
      glass(`screen-${side > 0 ? 'right' : 'left'}`, {
        x: (side * (width - pane)) / 2 - side * inset,
        y: wall + returns / 2,
        width: pane,
        depth: returns,
      }),
    ),
    glass('screen-front', {
      x: -(width - front) / 2 + inset,
      y: (depth - pane) / 2 - inset,
      width: front,
      depth: pane,
    }),
  ]
}

/**
 * A bath seen from straight above: the rim you sit on, the well sunk inside it,
 * and the tap standing at one end with the waste under it.
 *
 * All of it is honestly up there. A bath is one of the few fittings a plan sees
 * whole — the rim's top face, the water in the well, and a knob on the rim that
 * really does point at the reader.
 */
function bath(width: number, depth: number): Part[] {
  const height = 560
  const rim = 95
  const well = { width: width - rim * 2, depth: depth - rim * 2 }
  // A bath is filled at one of its short ends, and it empties at that end too.
  const end = -width / 2

  return [
    {
      key: 'rim',
      kind: 'rect',
      x: 0,
      y: 0,
      width,
      depth,
      radius: 100,
      lift: 0,
      base: 0,
      height,
    },
    {
      key: 'well',
      kind: 'rect',
      x: 0,
      y: 0,
      width: well.width,
      depth: well.depth,
      radius: 150,
      lift: 1,
      base: 140,
      height: height - 140,
      tone: 'dark',
    },
    {
      key: 'waste',
      kind: 'disc',
      x: end + rim + 170,
      y: 0,
      width: 90,
      depth: 90,
      lift: 2,
      base: 140,
      height: 10,
      tone: 'dark',
      show: 'plan',
    },
    tap({ x: end + rim / 2, y: 0 }, height, 3),
  ]
}

/**
 * A basin hung on the wall on its own: rounded right off at the front, squarer
 * where it meets the wall, which is the shape of the thing.
 */
function basin(width: number, depth: number): Part[] {
  const height = 850
  return [
    {
      key: 'body',
      kind: 'rect',
      x: 0,
      y: 0,
      width,
      depth,
      radius: {
        fl: Math.round(depth * 0.42),
        fr: Math.round(depth * 0.42),
        bl: 30,
        br: 30,
      },
      lift: 2,
      base: height - 160,
      height: 160,
    },
    ...bowlAndTap(width, depth, height - 130, height, 4, { across: 0.66, deep: 0.58 }),
  ]
}

/** The same basin, sunk into a cabinet standing under it. */
function vanity(width: number, depth: number): Part[] {
  const height = 850
  const thick = 40
  return [
    {
      key: 'top',
      kind: 'rect',
      x: 0,
      y: 0,
      width,
      depth,
      radius: 24,
      lift: 2,
      base: height - thick,
      height: thick,
    },
    ...bowlAndTap(width, depth, height - 300, height, 4, { across: 0.42, deep: 0.52 }, 'white'),
    ...legs(width * 0.9, depth * 0.8, height - thick, ''),
  ]
}

/**
 * A fridge: a box against the wall with its door across the front.
 *
 * The door is the whole point of drawing it at all. A plain rectangle is a
 * cupboard; a rectangle with a door and a handle over to one side is a fridge,
 * and it also says which way it opens, which is what decides where it can stand.
 */
function fridge(width: number, depth: number): Part[] {
  const height = 1850
  const door = 55
  // Seen from straight above, a fridge handle is the end of a bar standing off the
  // door — reaching out past the box, not a mark drawn on top of it.
  const handle = { width: 150, depth: 44 }
  const body = { depth: depth - handle.depth * 0.6, front: depth / 2 - handle.depth * 0.6 }

  return [
    {
      key: 'body',
      kind: 'rect',
      x: 0,
      y: -(handle.depth * 0.6) / 2,
      width,
      depth: body.depth,
      radius: 14,
      lift: 2,
      base: 0,
      height,
    },
    {
      key: 'door',
      kind: 'rect',
      x: 0,
      y: body.front - door / 2,
      width,
      depth: door,
      radius: 12,
      lift: 4,
      base: 100,
      height: height - 100,
    },
    {
      key: 'handle',
      kind: 'rect',
      x: width / 2 - handle.width / 2 - 70,
      y: body.front,
      width: handle.width,
      depth: handle.depth,
      radius: handle.depth / 2,
      lift: 6,
      base: 900,
      height: 40,
      tone: 'dark',
    },
  ]
}

/**
 * A cooker: the hob seen from above, over an oven door with a handle on it.
 *
 * Four rings and a door. The rings are what make it a cooker rather than a
 * cupboard, and they are genuinely up there facing the reader, so they are the
 * one thing about it a plan can honestly show.
 */
function cooker(width: number, depth: number): Part[] {
  const height = 900
  const [carcass] = units(width, depth, height, width)
  const ring = Math.min(width * 0.3, 190)
  const across = width * 0.24
  const along = (depth - 44) * 0.22

  const rings: Part[] = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([sx, sy], index) => ({
    key: `ring-${index}`,
    kind: 'disc' as const,
    x: (sx ?? 1) * across,
    y: -22 + (sy ?? 1) * along,
    width: ring,
    depth: ring,
    lift: 6,
    base: height,
    height: 8,
    tone: 'dark' as const,
    show: 'plan' as const,
  }))

  return [
    carcass!,
    {
      // The oven door, across the front under the hob.
      key: 'oven',
      kind: 'rect',
      x: 0,
      y: (depth - 44) / 2 - 22 - 40,
      width: width - 80,
      depth: 80,
      radius: 10,
      lift: 4,
      base: 100,
      height: 700,
      tone: 'dark',
    },
    ...rings,
    ...units(width, depth, height, width).slice(1),
  ]
}

/** A run of kitchen base units: the same thing, at worktop height. */
function cabinet(width: number, depth: number): Part[] {
  return units(width, depth, 900, 600)
}

/**
 * The same run with a sink let into the top: a square bowl, and the tap behind it.
 *
 * The bowl is stainless whatever the worktop is made of, the way the basin in a
 * walnut vanity is ceramic — and square-ish where a basin is an egg, which is most
 * of what tells the two apart from up here.
 */
function sink(width: number, depth: number): Part[] {
  const height = 900
  const stub = 44
  const bowl = { width: Math.min(width * 0.62, 560), depth: (depth - stub) * 0.6 }
  const middle = -stub / 2 + (depth - stub) * 0.08

  return [
    ...units(width, depth, height, 600),
    {
      key: 'bowl',
      kind: 'rect',
      x: 0,
      y: middle,
      width: bowl.width,
      depth: bowl.depth,
      radius: 40,
      lift: 6,
      base: height - 300,
      height: 300,
      surface: 'steel',
      show: 'plan',
    },
    tap({ x: 0, y: middle - bowl.depth / 2 - KNOB }, height, 8),
  ]
}

/**
 * A bed seen from straight above, which is very nearly all bedding.
 *
 * The frame is under the mattress and the mattress is under the cover, so what
 * the plan gets is the cover, the pillows laid on it, and a sliver of frame round
 * the edge — with the headboard standing proud at the wall end. The turned-down
 * sheet across the head is what keeps it from reading as a rectangle with two
 * lozenges on it: from up here it is the one thing saying which end you sleep at.
 */
function bed(width: number, depth: number, sleepers: number): Part[] {
  const frame = 55
  const board = 90
  const head = -depth / 2
  // The mattress: inside the frame and in front of the headboard.
  const bare = { width: width - frame * 2, from: head + board, to: depth / 2 - frame }
  const pillow = { depth: 340, gap: 60 }
  // The cover is laid on the mattress, not the whole of it: the foot of a made bed
  // shows a hand's width of sheet, and that is what says a cover is a cover.
  const cover = {
    width: bare.width - 40,
    from: bare.from + 40 + pillow.depth - 120,
    to: bare.to - 130,
  }
  const turn = 260
  const run = (bare.width - pillow.gap * (sleepers - 1)) / sleepers

  const pillows: Part[] = []
  for (let i = 0; i < sleepers; i += 1) {
    pillows.push({
      key: `pillow-${i}`,
      kind: 'rect',
      x: -bare.width / 2 + run / 2 + i * (run + pillow.gap),
      y: bare.from + 40 + pillow.depth / 2,
      width: run,
      depth: pillow.depth,
      radius: 90,
      lift: 5,
      base: 620,
      height: 120,
      tone: 'light',
      relief: true,
      plain: true,
    })
  }

  return [
    ...legs(width, depth, 300, ''),
    {
      // The frame, showing as a line round the bedding rather than as furniture.
      key: 'frame',
      kind: 'rect',
      x: 0,
      y: 0,
      width,
      depth,
      radius: 40,
      lift: 0,
      base: 300,
      height: 300,
      tone: 'dark',
      plain: true,
    },
    {
      key: 'headboard',
      kind: 'rect',
      x: 0,
      y: head + board / 2,
      width,
      depth: board,
      radius: { bl: 30, br: 30 },
      lift: 4,
      base: 300,
      height: 800,
      tone: 'dark',
      plain: true,
    },
    {
      // The bare mattress under the lot, which is what shows at the foot.
      key: 'mattress',
      kind: 'rect',
      x: 0,
      y: (bare.from + bare.to) / 2,
      width: bare.width,
      depth: bare.to - bare.from,
      radius: 30,
      lift: 1,
      base: 400,
      height: 200,
      tone: 'light',
      plain: true,
    },
    {
      // The cover laid over it: its own soft shape with its own edge, the way the
      // pillows are, rather than a panel painted onto the mattress.
      key: 'duvet',
      kind: 'rect',
      x: 0,
      y: (cover.from + cover.to) / 2,
      width: cover.width,
      depth: cover.to - cover.from,
      radius: 60,
      lift: 2,
      base: 600,
      height: 160,
      relief: true,
      plain: true,
    },
    {
      // The sheet folded back over the top of the cover, below the pillows rather
      // than under them: laid at the head it disappears beneath them entirely.
      key: 'turn',
      kind: 'rect',
      x: 0,
      y: cover.from + turn / 2,
      width: cover.width,
      depth: turn,
      radius: { bl: 60, br: 60 },
      lift: 3,
      base: 620,
      height: 150,
      tone: 'light',
      plain: true,
    },
    ...pillows,
  ]
}

/**
 * How wide the shadow at a step is, which is the whole of how a flight going down
 * is told from one going up.
 *
 * There is no arrow. Two flights seen from straight overhead have the very same
 * outline, and the honest difference between them is light: a stair going up
 * stands on this floor and is lit end to end, so every step is marked the same.
 * One going down is a well cut through the floor, and the further down it goes
 * the less of the room's light gets there — so the shade at each step widens as
 * it descends, until the bottom of the flight is nearly all of it.
 */
const LIP = 22

function shadow(pitch: number, level: number, storey: number, rising: boolean): number {
  const well = rising ? 0 : Math.min(1, Math.max(0, -level / storey))
  return Math.round(pitch * (0.24 + 0.6 * well))
}

/**
 * A flight of stairs seen from straight above.
 *
 * The trouble with a stair from up here is that a flight of steps and a ladder
 * lying on the floor draw the same picture: a run of parallel lines. What tells
 * them apart is the step itself — the riser standing under each tread, in the
 * shade of the nosing that overhangs it, with the nosing's own edge lit on top.
 * Two marks per step, and the run reads as something you could climb.
 *
 * The treads are the thing and the model builds them, one slab per tread at its
 * own height. The plan takes their tops as one surface instead, or a metre of
 * marble comes out printed on every tread and the flight reads as wallpaper.
 *
 * Up and down are the same staircase seen from the two floors it joins, and no
 * shape can tell them apart from overhead: all that differs is where the run
 * hangs relative to the floor it is drawn on. So the light does the telling —
 * see `shadow` — and there is no arrow anywhere.
 */
function staircase(width: number, depth: number, rising: boolean): Part[] {
  // A storey and the treads that get you up it. A wider flight gets more treads
  // rather than longer goings, up to the point where a flight is still a flight.
  const storey = 2900
  const steps = Math.min(18, Math.max(3, Math.round(width / 250)))
  const rise = Math.round(storey / (steps + 1))
  const nose = 25
  const run = (width - nose) / steps
  const slab = 40
  // The low end is always the same end. What the flight's direction changes is
  // where the run hangs: a flight up climbs off this floor, and a flight down is
  // that same climb seen from the top, so all of it hangs under the floor.
  const floor = rising ? 0 : -(steps + 1) * rise

  const treads: Part[] = []
  for (let i = 0; i < steps; i += 1) {
    treads.push({
      key: `tread-${i}`,
      kind: 'rect',
      x: -width / 2 + i * run + (run + nose) / 2,
      y: 0,
      width: run + nose,
      depth,
      lift: 0,
      base: floor + (i + 1) * rise - slab,
      height: slab,
      show: 'model',
    })
  }

  // The steps as they are seen: the riser standing under each tread, in the shade
  // of the nosing hanging over it. It falls on the low side of where two treads
  // meet, because that is the side the tread above hangs over. Drawn as a line,
  // so it neither loses its middle to its own edge nor fringes the foot of the
  // flight with a shadow of its own.
  const marks: Part[] = []
  for (let i = 1; i < steps; i += 1) {
    const level = floor + i * rise
    const dark = shadow(width / steps, level, storey, rising)
    // Ruled evenly across the flight. The treads themselves lap by a nosing, so
    // stepping the marks along with them leaves the two end steps visibly
    // unequal — and a stair whose top step is half as wide again reads as a
    // mistake rather than as a stair.
    const joint = -width / 2 + (i * width) / steps
    // Stopping under the rail rather than running out past it: a riser ends where
    // the balustrade stands on it, and a bar poking out below the rail reads as a
    // grille rather than as a flight of steps.
    const across = { y: -30, depth: depth - 60 }

    marks.push(
      {
        key: `riser-${i}`,
        kind: 'rect',
        x: joint - dark / 2,
        ...across,
        width: dark,
        lift: 1,
        base: level - slab,
        height: slab,
        tone: 'dark',
        paint: 'line',
        show: 'plan',
      },
      {
        // The lip of the nosing, catching the light on the step above its own
        // shadow. One mark says a line is there; the pair says it is a step.
        key: `nosing-${i}`,
        kind: 'rect',
        x: joint + LIP / 2,
        ...across,
        width: LIP,
        lift: 2,
        base: level - slab,
        height: slab,
        tone: 'light',
        paint: 'line',
        show: 'plan',
      },
    )
  }

  return [
    ...treads,
    {
      // The tops of every tread, taken as one surface. This is the only part the
      // flight's own material is drawn on, and the marks are laid over it.
      key: 'flight',
      kind: 'rect',
      x: 0,
      y: 0,
      width,
      depth,
      radius: 8,
      lift: 0,
      base: floor + rise - slab,
      height: slab,
      show: 'plan',
    },
    ...marks,
    {
      // The rail on the open side, over the front strip of every tread it passes.
      // Set at the height it stands over the bottom tread: a raked rail is a slope
      // and a part is a box, so the model gets the run of it and is owed the pitch.
      key: 'rail',
      kind: 'rect',
      x: 0,
      y: depth / 2 - 60,
      width,
      depth: 60,
      radius: 30,
      lift: 4,
      base: floor + rise + 900,
      height: 50,
      tone: 'dark',
    },
  ]
}

/**
 * A staircase that turns back on itself: two flights side by side with the wall
 * standing between them, and the landing across the end where you turn.
 *
 * Which is how a stair is built when there is no room for four metres of run —
 * half the length, twice the depth, and a wall down the spine that the flights
 * are hung either side of. The wall is drawn as a wall and not as joinery,
 * because that is what it is: the stair is oak or marble and the wall is neither.
 *
 * You set off on the flight nearest the room and come up the one against the
 * wall — going down, the other way about. Which of the two it is, is read off the
 * shade at the steps, exactly as on a straight flight.
 */
function staircaseTurn(width: number, depth: number, rising: boolean): Part[] {
  const storey = 2900
  const spine = 150
  const flight = (depth - spine) / 2
  const landing = Math.min(flight, width / 3)
  const run = width - landing
  // Treads to a flight, and one riser more than that: the last step of the first
  // flight is the landing itself, and the last step of the second is the floor
  // above. Sixteen risers to the storey, which is what a stair is built at.
  const steps = 7
  const rise = Math.round(storey / (2 * (steps + 1)))
  const slab = 40
  const floor = rising ? 0 : -2 * (steps + 1) * rise
  const pitch = run / steps
  // The flights lie either side of the spine, and the near one is where you start.
  const across = (flight + spine) / 2
  const start = -width / 2

  const treads: Part[] = []
  for (let i = 0; i < steps; i += 1) {
    treads.push({
      key: `tread-a-${i}`,
      kind: 'rect',
      x: start + (i + 0.5) * pitch,
      y: across,
      width: pitch,
      depth: flight,
      lift: 0,
      base: floor + (i + 1) * rise - slab,
      height: slab,
      show: 'model',
    })
    treads.push({
      // Coming back the other way, and a whole flight further up.
      key: `tread-b-${i}`,
      kind: 'rect',
      x: start + run - (i + 0.5) * pitch,
      y: -across,
      width: pitch,
      depth: flight,
      lift: 0,
      base: floor + (steps + i + 2) * rise - slab,
      height: slab,
      show: 'model',
    })
  }

  const marks: Part[] = []
  for (const side of [1, -1]) {
    for (let i = 1; i < steps; i += 1) {
      // The near flight climbs with the marks and the far one climbs against
      // them, so the same rule shades a well that spirals rather than one that
      // simply falls away: darkest at the foot, barely there where you step on.
      const level = floor + (side > 0 ? i : 2 * (steps + 1) - i) * rise
      const dark = shadow(pitch, level, storey, rising)
      const at = side > 0 ? 'a' : 'b'
      marks.push(
        {
          key: `riser-${at}-${i}`,
          kind: 'rect',
          x: start + i * pitch - dark / 2,
          y: side * across,
          width: dark,
          depth: flight,
          lift: 1,
          base: level - slab,
          height: slab,
          tone: 'dark',
          paint: 'line',
          show: 'plan',
        },
        {
          key: `nosing-${at}-${i}`,
          kind: 'rect',
          x: start + i * pitch + LIP / 2,
          y: side * across,
          width: LIP,
          depth: flight,
          lift: 2,
          base: level - slab,
          height: slab,
          tone: 'light',
          paint: 'line',
          show: 'plan',
        },
      )
    }
  }

  return [
    ...treads,
    ...[1, -1].map((side) => ({
      key: `flight-${side > 0 ? 'a' : 'b'}`,
      kind: 'rect' as const,
      x: start + run / 2,
      y: side * across,
      width: run,
      depth: flight,
      lift: 0,
      base: floor + rise - slab,
      height: slab,
      show: 'plan' as const,
    })),
    {
      // The half-landing, across the end both flights meet at.
      key: 'landing',
      kind: 'rect',
      x: width / 2 - landing / 2,
      y: 0,
      width: landing,
      depth,
      lift: 0,
      base: floor + (steps + 1) * rise - slab,
      height: slab,
      show: 'plan',
    },
    ...marks,
    {
      // The spine. Drawn as a wall in its own right, because it is one: the stair
      // is oak or marble and the thing the two flights hang off is neither.
      key: 'spine',
      kind: 'rect',
      x: start + run / 2,
      y: 0,
      width: run,
      depth: spine,
      lift: 4,
      base: floor,
      height: storey,
      surface: 'black',
    },
  ]
}

const TOP = 740

const SKELETONS: Record<string, (object: HouseObject) => Part[]> = {
  table: (object) => [
    ...seating(object.width, object.depth, object.seats ?? 0),
    ...legs(object.width, object.depth, TOP, ''),
    {
      key: 'top',
      kind: 'rect',
      x: 0,
      y: 0,
      width: object.width,
      depth: object.depth,
      radius: 70,
      lift: 8,
      base: TOP,
      height: 42,
    },
  ],
  'table-round': (object) => [
    ...seatingRound(Math.min(object.width, object.depth), object.seats ?? 0),
    ...pedestal(Math.min(object.width, object.depth)),
    {
      key: 'top',
      kind: 'disc',
      x: 0,
      y: 0,
      width: object.width,
      depth: object.depth,
      lift: 8,
      base: TOP,
      height: 42,
    },
  ],
  bedside: (object) => bedside(object.width, object.depth),
  sofa: (object) => upholstered(object.width, object.depth, object.seats ?? 3),
  armchair: (object) => upholstered(object.width, object.depth, 1),
  chair: (object) => chair(object.width, object.depth),
  rug: (object) => rug(object.width, object.depth),
  'rug-small': (object) => rug(object.width, object.depth),
  plant: (object) => plant(object.width, object.depth, object.id),
  // The same plant, only bigger: one skeleton, two sizes in the catalogue.
  'plant-large': (object) => plant(object.width, object.depth, object.id),
  toilet: (object) => toilet(object.width, object.depth),
  fridge: (object) => fridge(object.width, object.depth),
  cabinet: (object) => cabinet(object.width, object.depth),
  sink: (object) => sink(object.width, object.depth),
  cooker: (object) => cooker(object.width, object.depth),
  basin: (object) => basin(object.width, object.depth),
  vanity: (object) => vanity(object.width, object.depth),
  bin: (object) => bin(object.width, object.depth),
  'toilet-roll': (object) => toiletRoll(object.width, object.depth),
  'tv-stand': (object) => sideboard(object.width, object.depth),
  'tv-stand-small': (object) => sideboard(object.width, object.depth),
  bath: (object) => bath(object.width, object.depth),
  shower: (object) => shower(object.width, object.depth),
  bed: (object) => bed(object.width, object.depth, 2),
  'bed-single': (object) => bed(object.width, object.depth, 1),
  'stairs-up': (object) => staircase(object.width, object.depth, true),
  'stairs-turn-up': (object) => staircaseTurn(object.width, object.depth, true),
  'stairs-turn-down': (object) => staircaseTurn(object.width, object.depth, false),
  'stairs-down': (object) => staircase(object.width, object.depth, false),
  tv: (object) => television(object.width, object.depth),
  'tv-large': (object) => television(object.width, object.depth),
}

/** The shape of one object, or its bare footprint if it has no skeleton yet. */
export function skeletonOf(object: HouseObject): Part[] {
  const build = SKELETONS[object.type]
  if (build) return build(object)
  return [
    {
      key: 'body',
      kind: 'rect',
      x: 0,
      y: 0,
      width: object.width,
      depth: object.depth,
      lift: 0,
      base: 0,
      height: 700,
    },
  ]
}
