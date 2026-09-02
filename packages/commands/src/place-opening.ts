import type { HouseDocument, Opening } from '@houseit/core/document'
import { boundaryWallsOf } from '@houseit/geometry/boundary'
import type { Point } from '@houseit/geometry/outlines'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { sideRun } from '@houseit/geometry/sides'
import { freeSpans, type Span, spanAround } from '@houseit/geometry/spans'
import { footprintOf, standingAt } from '@houseit/geometry/standing'
import { type Box, boxOf, clashes } from './boxes'
import { CommandError } from './command-error'

export type Side = 'north' | 'south' | 'east' | 'west'

/** The coordinate a wall on that side holds constant, and which end of it to take. */
const SIDES = {
  west: { axis: 'x', low: true },
  east: { axis: 'x', low: false },
  south: { axis: 'y', low: true },
  north: { axis: 'y', low: false },
} as const satisfies Record<Side, { axis: 'x' | 'y'; low: boolean }>

export type Placement = {
  wall: string
  /** Along the wall, 0 at end `a` and 1 at end `b`. */
  t: number
  /**
   * Which side of the wall the room lies on, as a sign across it. A door swings
   * into the room it was named from, so this is what decides which way it opens.
   */
  swing: -1 | 1
}

/**
 * Where an opening of a given width goes in the wall on one side of a room.
 *
 * Nothing here takes a position: you know the bedroom looks south, not that its
 * window starts 2.4 m from the corner. So the position is chosen — the middle of
 * the widest stretch of that wall still free. One opening centres itself and a
 * second falls beside it, without either command naming a place.
 */
export function placeOpening(
  doc: HouseDocument,
  level: string,
  room: Room,
  side: Side,
  width: number,
  what: string,
  swings = false,
  /** An opening to leave out of the count: the one being moved is not in its own way. */
  except?: string,
): Placement {
  // A side can be more than one wall, and the roomiest is only the best guess at
  // which of them to use. Cut a hall out of a living room and its far side is two
  // partitions of the very same length, one with the staircase along the whole of
  // it — so every one of them is tried before the answer is no.
  const walls = wallsFacing(doc, level, room, side, what).sort(
    (one, other) => spanOf(other) - spanOf(one),
  )
  const widest = spanOf(walls[0]!)
  if (width > widest) {
    throw new CommandError(
      `${what}: ${width} mm does not fit the ${widest} mm wall on the ${side} side of ${room.name}`,
    )
  }

  let roomToStand = false
  for (const chosen of walls) {
    const span = spanOf(chosen)
    if (width > span) continue

    const taken = [
      ...Object.values(doc.openings)
        .filter((opening) => opening.wall === chosen.wall.id && opening.id !== except)
        .map((opening) => spanAround(opening.t * span, opening.width)),
      // Only a door. A window has nothing to keep clear of — a sofa under a
      // window is where a sofa goes, and the same is true of a bed and a worktop.
      ...(swings ? standingOn(doc, level, chosen, span) : []),
    ]
    const gaps = freeSpans(span, taken)
      .filter((free) => free.to - free.from >= width)
      .sort((one, other) => other.to - other.from - (one.to - one.from))
    if (gaps.length === 0) continue
    roomToStand = true

    const swing = sideSign(chosen.a, chosen.b, room.centre)
    // The middle of a stretch first, because that is where an opening looks like
    // it was meant to go; hard against either end only when the middle is taken.
    const tries = gaps.flatMap((free) => [
      (free.from + free.to) / 2,
      free.from + width / 2,
      free.to - width / 2,
    ])
    const at = swings
      ? tries.find((spot) => swingIsClear(doc, level, chosen, span, spot, width, swing, except))
      : tries[0]

    if (at !== undefined) return { wall: chosen.wall.id, t: at / span, swing }
  }

  throw new CommandError(
    roomToStand
      ? `${what}: a ${width} mm door in the ${side} wall of ${room.name} has nowhere to open — ` +
          `everywhere it would fit, something is standing in front of it`
      : `${what}: ${width} mm does not fit beside the openings already in the ${side} wall of ${room.name}`,
  )
}

/**
 * Where an opening goes when somebody says exactly where: this far along one
 * side of a room, in the sense `add-object --along` uses, 0 at the west or
 * south end and 1 at the other. What a drag on the plan ends in, and what an
 * agent says when the middle of the free stretch is not what it wants.
 *
 * Checked the way a chosen place is checked: it has to lie in one wall of that
 * side, clear of the openings already there, and a door has to be able to open.
 * Refused with the reason, so the drag can say it.
 */
export function placeOpeningAt(
  doc: HouseDocument,
  level: string,
  room: Room,
  side: Side,
  width: number,
  along: number,
  what: string,
  swings = false,
  except?: string,
): Placement {
  const run = sideRun(doc, level, room, side)
  if (!run) throw new CommandError(`${what}: ${room.name} has no wall facing ${side}`)
  const centre = {
    x: run.from.x + (run.to.x - run.from.x) * along,
    y: run.from.y + (run.to.y - run.from.y) * along,
  }

  const walls = wallsFacing(doc, level, room, side, what)
  const found = walls
    .map((wall) => {
      const span = spanOf(wall)
      const at =
        ((centre.x - wall.a.x) * (wall.b.x - wall.a.x) +
          (centre.y - wall.a.y) * (wall.b.y - wall.a.y)) /
        (span || 1)
      return { wall, span, at }
    })
    .find(({ span, at }) => at >= 0 && at <= span)
  if (!found) {
    throw new CommandError(
      `${what}: there is no wall at ${along} along the ${side} side of ${room.name}`,
    )
  }
  const { wall: chosen, span, at } = found
  const swing = checkOpeningAt(doc, level, room, chosen.wall.id, at, width, what, swings, except)
  return { wall: chosen.wall.id, t: at / span, swing }
}

/**
 * Whether an opening of a width can be at a place in a wall: within the
 * wall's length, clear of the other openings in it, and — for a door that
 * swings — with nothing standing in its swing. Refused with the reason;
 * otherwise the way the door swings, towards the room it was asked from.
 */
export function checkOpeningAt(
  doc: HouseDocument,
  level: string,
  room: Room,
  wallId: string,
  at: number,
  width: number,
  what: string,
  swings = false,
  except?: string,
): -1 | 1 {
  const wall = doc.walls[wallId]
  const a = wall && doc.nodes[wall.a]
  const b = wall && doc.nodes[wall.b]
  if (!wall || !a || !b) throw new CommandError(`${what}: there is no such wall`)
  const chosen = { wall: { id: wallId }, a, b }
  const span = spanOf(chosen)
  const where = `the wall of ${room.name}`

  if (at - width / 2 < 0 || at + width / 2 > span) {
    throw new CommandError(`${what}: ${width} mm there runs past the end of ${where}`)
  }
  const wanted = spanAround(at, width)
  const overlapping = Object.values(doc.openings).find((opening) => {
    if (opening.wall !== wallId || opening.id === except) return false
    const other = spanAround(opening.t * span, opening.width)
    return other.from < wanted.to && wanted.from < other.to
  })
  if (overlapping) {
    throw new CommandError(
      `${what}: there is already a ${overlapping.kind} at that place in ${where}`,
    )
  }

  const swing = sideSign(a, b, room.centre)
  if (swings && !swingIsClear(doc, level, chosen, span, at, width, swing, except)) {
    throw new CommandError(
      `${what}: a door there could not open — something is standing in its swing`,
    )
  }
  return swing
}

/**
 * The floor a door needs to itself: the square its leaf sweeps as it opens.
 *
 * A quarter circle, boxed. The box is the more generous of the two and that is
 * the point — a door that opens to within a hand's breadth of the washbasin is a
 * door somebody squeezes past, and a drawing should not offer it.
 */
function sweptBy(a: Point, b: Point, span: number, at: number, width: number, swing: -1 | 1): Box {
  const unit = { x: (b.x - a.x) / (span || 1), y: (b.y - a.y) / (span || 1) }
  // A quarter turn across the wall, the way the room lies.
  const into = { x: -unit.y * swing, y: unit.x * swing }
  const hinge = { x: a.x + unit.x * (at - width / 2), y: a.y + unit.y * (at - width / 2) }

  return boxOf(
    [0, 1].flatMap((along) =>
      [0, 1].map((out) => ({
        x: hinge.x + unit.x * width * along + into.x * width * out,
        y: hinge.y + unit.y * width * along + into.y * width * out,
      })),
    ),
  )
}

/**
 * Where a door already in the plan opens, or nothing if it is a window — or a
 * door that does not swing: a sliding or pocket door runs along its wall, and a
 * garage door lifts, so the car in front of it is where the car goes.
 */
export function swingOf(doc: HouseDocument, opening: Opening): Box | undefined {
  if (opening.kind !== 'door' || opening.variant !== 'hinged') return undefined
  const wall = doc.walls[opening.wall]
  const a = wall && doc.nodes[wall.a]
  const b = wall && doc.nodes[wall.b]
  if (!a || !b) return undefined

  const span = Math.hypot(b.x - a.x, b.y - a.y)
  return sweptBy(a, b, span, opening.t * span, opening.width, opening.swing)
}

/**
 * Whether a door put there could actually be opened.
 *
 * Keeping a door clear of the wall it is in was never the whole job: a door
 * sweeps a quarter of a circle out into the room, and what is standing in that
 * quarter matters as much as what is beside it. Two doors in one corner bang into
 * each other, and a door across the basin does not open at all — and the plan
 * draws both without a murmur, because nothing in the drawing knows.
 */
function swingIsClear(
  doc: HouseDocument,
  level: string,
  chosen: Facing,
  span: number,
  at: number,
  width: number,
  swing: -1 | 1,
  except?: string,
): boolean {
  const box = sweptBy(chosen.a, chosen.b, span, at, width, swing)

  const doors = Object.values(doc.openings)
    .filter((opening) => opening.id !== except && doc.walls[opening.wall]?.level === level)
    .map((opening) => swingOf(doc, opening))
    .filter((other): other is Box => other !== undefined)
  if (doors.some((other) => clashes(box, other))) return false

  const rooms = new Map(
    roomsOf(doc, level)
      .filter((room) => room.id)
      .map((room) => [room.id!, room] as const),
  )
  return !Object.values(doc.objects)
    .filter((object) => object.level === level)
    .some((object) => {
      const room = rooms.get(object.room)
      const spot = room && standingAt(doc, level, room, object)
      if (!spot) return false
      return clashes(box, boxOf(footprintOf(spot, object)))
    })
}

/**
 * What is already standing along that wall, as stretches of it that are spoken for.
 *
 * The other half of the bargain `place-object` keeps: furniture is kept clear of
 * the doors, so doors are kept clear of the furniture. Without it a door can be
 * hung behind the staircase — the plan draws both, quite happily, and neither the
 * drawing nor a test says a word about the door nobody can walk through.
 *
 * Everything at that wall counts, not merely what is in the room the door was
 * asked for. A door has two faces and only one of them is in that room; the
 * lavatory standing against the far face is in the way exactly as much, which is
 * how the first go at this put a door through the toilet in the bathroom next
 * door. So nothing is filtered by room or by side — what settles it is standing
 * out in front of this wall, whichever side of it that is.
 */
function standingOn(doc: HouseDocument, level: string, chosen: Facing, span: number): Span[] {
  const rooms = new Map(
    roomsOf(doc, level)
      .filter((room) => room.id)
      .map((room) => [room.id!, room] as const),
  )
  const unit = {
    x: (chosen.b.x - chosen.a.x) / (span || 1),
    y: (chosen.b.y - chosen.a.y) / (span || 1),
  }
  // How far off the wall's centre line a thing may be and still be up against it:
  // half the wall, and a hand's breadth of room for the ones that stand a little
  // proud. Measured against the thing's own corners rather than its middle, or a
  // staircase at the wall round the corner counts as standing at this one.
  const reach = (doc.walls[chosen.wall.id]?.thickness ?? 0) / 2 + 120

  return Object.values(doc.objects)
    .filter((object) => object.level === level && object.against !== undefined)
    .flatMap((object) => {
      const room = rooms.get(object.room)
      const spot = room && standingAt(doc, level, room, object)
      if (!spot) return []

      const corners = footprintOf(spot, object).map((corner) => ({
        along: (corner.x - chosen.a.x) * unit.x + (corner.y - chosen.a.y) * unit.y,
        off: Math.abs((corner.x - chosen.a.x) * unit.y - (corner.y - chosen.a.y) * unit.x),
      }))
      if (Math.min(...corners.map((corner) => corner.off)) > reach) return []

      const alongs = corners.map((corner) => corner.along)
      return [{ from: Math.min(...alongs), to: Math.max(...alongs) }]
    })
}

/**
 * The walls of a room that face one way, the outermost ones only.
 *
 * A side is not always one wall: cut a room out of a corner and the wall it faces
 * across can end up in two pieces. Everything at the outermost offset counts,
 * because that is what somebody means by "the south wall" — the front of the
 * house, not a partition standing back from it.
 */
export function wallsFacing(
  doc: HouseDocument,
  level: string,
  room: Room,
  side: Side,
  what: string,
): Facing[] {
  const { axis, low } = SIDES[side]
  const walls = boundaryWallsOf(doc, level, room)
    .map((wall) => ({ wall, a: doc.nodes[wall.a]!, b: doc.nodes[wall.b]! }))
    .filter(({ a, b }) => a && b && a[axis] === b[axis])

  if (walls.length === 0) {
    throw new CommandError(`${what}: ${room.name} has no wall facing ${side}`)
  }

  const offsets = walls.map(({ a }) => a[axis])
  const outermost = low ? Math.min(...offsets) : Math.max(...offsets)
  return walls.filter(({ a }) => a[axis] === outermost)
}

type Facing = { wall: { id: string }; a: { x: number; y: number }; b: { x: number; y: number } }

const spanOf = ({ a, b }: { a: { x: number; y: number }; b: { x: number; y: number } }) =>
  Math.round(Math.hypot(b.x - a.x, b.y - a.y))

/**
 * Which side of the wall a point lies on, positive being a quarter turn
 * counter-clockwise from the wall's own direction. A door's `swing` is this,
 * for the room it opens into.
 */
export function sideSign(
  a: { x: number; y: number },
  b: { x: number; y: number },
  point: { x: number; y: number },
): -1 | 1 {
  const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x)
  return cross < 0 ? -1 : 1
}
