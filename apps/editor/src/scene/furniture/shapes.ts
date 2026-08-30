import { Shape } from 'three'
import { MM } from '../plan-coordinates'
import type { Corners, Part } from './skeleton'

/** A drawn line at furniture scale, in millimetres. Thinner than a wall's. */
export const LINE = 16

/**
 * A part as two outlines: the whole of it, and the same shape one line weight
 * smaller. Drawing the second over the first in a different colour is what puts
 * an edge round a filled shape, and it is the same trick the walls use — cheaper
 * than a stroke, and it cannot come apart at the corners.
 */
export function outlineAndFill(part: Part): { outline: Shape; fill: Shape } {
  return { outline: shapeOf(part, 0), fill: shapeOf(part, LINE) }
}

/** How far the lit and shaded bands run in from a part's own edge, in millimetres. */
export const RIM = 14

/**
 * The three shapes that model an edge, all of them inside the part's outline.
 *
 * Laid over each other in order, they leave a band of light along one edge and a
 * band of shade along the other, with the surface's own colour between. Doing it
 * with copies offset outside the shape was the first attempt, and it read as three
 * pieces of furniture stacked slightly out of line rather than as one with a
 * thickness.
 */
export function modelled(part: Part): { lit: Shape; shaded: Shape; middle: Shape } {
  return {
    lit: shapeOf(part, LINE),
    shaded: shapeOf(part, LINE + RIM),
    middle: shapeOf(part, LINE + RIM * 2),
  }
}

function shapeOf(part: Part, inset: number): Shape {
  const width = Math.max(1, part.width - inset * 2) * MM
  const depth = Math.max(1, part.depth - inset * 2) * MM

  if (part.kind === 'disc') return ellipse(width / 2, depth / 2)
  if (part.kind === 'band')
    return band(width / 2, depth, Math.max(1, (part.wall ?? 40) - inset) * MM)
  return rounded(width, depth, cornersOf(part.radius, inset), part.bevel ?? false)
}

function ellipse(rx: number, ry: number): Shape {
  const shape = new Shape()
  shape.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0)
  return shape
}

/**
 * A curved bar bowing away from the way the thing faces: a chair's back.
 *
 * A band and not a filled half-disc. Filled, it reads as a shell in the plan, and
 * pushed up into the model it becomes a solid block rather than something to sit
 * against.
 */
function band(rx: number, drop: number, wall: number): Shape {
  // Walked out along the outer edge and back along the inner one, point by point.
  // Left to `absellipse`, the two arcs come out running the same way round, the
  // outline crosses itself, and the triangulation turns a chair back into a spike.
  const steps = 24
  const inner = { rx: Math.max(0.001, rx - wall), drop: Math.max(0.001, drop - wall) }
  const shape = new Shape()

  for (let i = 0; i <= steps; i += 1) {
    const angle = Math.PI + (Math.PI * i) / steps
    const x = Math.cos(angle) * rx
    const y = Math.sin(angle) * drop
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  for (let i = steps; i >= 0; i -= 1) {
    const angle = Math.PI + (Math.PI * i) / steps
    shape.lineTo(Math.cos(angle) * inner.rx, Math.sin(angle) * inner.drop)
  }
  shape.closePath()
  return shape
}

/** The four radii in metres, pulled in by the inset and never past half a side. */
function cornersOf(radius: Part['radius'], inset: number): Required<Corners> {
  const given =
    typeof radius === 'number' ? { fl: radius, fr: radius, br: radius, bl: radius } : (radius ?? {})
  const pull = (value = 0) => Math.max(0, value - inset) * MM
  return { fl: pull(given.fl), fr: pull(given.fr), br: pull(given.br), bl: pull(given.bl) }
}

/**
 * A rectangle rounded a corner at a time.
 *
 * Uniform rounding is what made a run of cushions look chewed: pieces meant to sit
 * flush against one another opened a notch at every joint. Round the outside,
 * leave square whatever a neighbour is going to cover, and the run reads as one
 * piece of furniture.
 */
function rounded(width: number, depth: number, corner: Required<Corners>, bevel: boolean): Shape {
  const x = width / 2
  const y = depth / 2
  const cap = (value: number) => Math.min(value, x, y)
  const bl = cap(corner.bl)
  const br = cap(corner.br)
  const fr = cap(corner.fr)
  const fl = cap(corner.fl)
  const shape = new Shape()
  // Bevelled, the corner is walked straight across; rounded, it is curved through
  // the corner itself. The same eight points either way.
  const turn = (cx: number, cy: number, tx: number, ty: number) =>
    bevel ? shape.lineTo(tx, ty) : shape.quadraticCurveTo(cx, cy, tx, ty)

  shape.moveTo(-x + bl, -y)
  shape.lineTo(x - br, -y)
  if (br > 0) turn(x, -y, x, -y + br)
  shape.lineTo(x, y - fr)
  if (fr > 0) turn(x, y, x - fr, y)
  shape.lineTo(-x + fl, y)
  if (fl > 0) turn(-x, y, -x, y - fl)
  shape.lineTo(-x, -y + bl)
  if (bl > 0) turn(-x, -y, -x + bl, -y)
  return shape
}
