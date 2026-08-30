import type { HouseDocument, Side } from '@houseit/core/document'
import { type Layer, layerOf } from '@houseit/core/object-types'
import type { Room } from '@houseit/geometry/rooms'
import { type SideRun, sideRun } from '@houseit/geometry/sides'
import { freeSpans, type Span, spanAround } from '@houseit/geometry/spans'
import { reachOf } from '@houseit/geometry/standing'

export type Spot = { against?: Side; along: number }

const SIDES: Side[] = ['north', 'east', 'south', 'west']

/**
 * Where something goes in a room.
 *
 * Nobody says a table stands at x=4500; they say it stands in the kitchen. So the
 * position is worked out here rather than asked for: the middle of the widest
 * stretch still clear. Ask for no side and, if the thing belongs against a wall,
 * the room is asked which of its walls has the most room left.
 *
 * Doors are kept clear because standing furniture across one makes a plan that
 * cannot be lived in. Windows are not: a sofa under a window is where a sofa goes.
 */
export function placeAgainst(
  doc: HouseDocument,
  level: string,
  room: Room,
  side: Side,
  width: number,
  layer: Layer = 'floor',
  abuts = false,
): Spot[] {
  const run = sideRun(doc, level, room, side)
  if (!run || run.length < width) return []

  const gaps = wideEnough(
    freeSpans(run.length, occupied(doc, level, room, side, run, layer)),
    width,
  )
  return gaps.flatMap((gap) =>
    alongOf(gap, width, run.length, abuts).map((at) => ({
      against: side,
      along: at / run.length,
    })),
  )
}

/**
 * Where in a clear stretch a thing goes: the middle of it, or hard against one end.
 *
 * A kitchen is a run. Units, sink, cooker and fridge butt up against whatever is
 * already there and the space left over goes at the ends — put each new one in the
 * middle of what is free and you get a kitchen with a gap in it, which is not a
 * kitchen anybody builds. An end that is not the end of the wall is an end with
 * something already standing at it, so those come first.
 */
function alongOf(gap: Span, width: number, length: number, abuts: boolean): number[] {
  const middle = (gap.from + gap.to) / 2
  const ends = [
    { at: gap.from + width / 2, beside: gap.from > 0 },
    { at: gap.to - width / 2, beside: gap.to < length },
  ]

  // The middle is where a thing looks like it was meant to go, so it is asked for
  // first — but a wall has two ends, and something already filling the corner
  // round one of them is a reason to slide along rather than a reason to refuse.
  if (!abuts) return [middle, ...ends.map((end) => end.at)]

  return [...ends.filter((end) => end.beside), ...ends.filter((end) => !end.beside)]
    .map((end) => end.at)
    .concat(middle)
}

/** Every side with room left on it, the roomiest first. */
export function placeSomewhereAgainst(
  doc: HouseDocument,
  level: string,
  room: Room,
  width: number,
  layer: Layer = 'floor',
  abuts = false,
): Spot[] {
  return SIDES.flatMap((side) => placeAgainst(doc, level, room, side, width, layer, abuts))
}

/**
 * Standing free, along a line through the middle of the room. A second chair
 * lands beside the first rather than inside it, without either being given a
 * position.
 */
export function placeFree(
  doc: HouseDocument,
  room: Room,
  width: number,
  layer: Layer = 'floor',
): Spot[] {
  const span = freeWidth(doc, room)
  if (span < width) return []

  // Only a thing on the same layer is in the way: a table takes no notice of the
  // rug it stands on, and the rug takes none of the table. Two rugs still move
  // over for one another, or they end up stacked.
  const taken = Object.values(doc.objects)
    .filter(
      (object) => object.room === room.id && !object.against && layerOf(object.type) === layer,
    )
    .map((object) => spanAround(object.along * span, reachOf(object).across))

  return wideEnough(freeSpans(span, taken), width).map((gap) => ({
    along: (gap.from + gap.to) / 2 / span,
  }))
}

/**
 * Every clear stretch a thing would fit in, roomiest first.
 *
 * More than one on purpose. The roomiest stretch is the best guess, but in a room
 * that is not a rectangle the best guess can still hang out over a corner — so
 * whoever asked gets the rest of the list to fall back on rather than a refusal.
 */
function wideEnough(spans: Span[], width: number): Span[] {
  return spans
    .filter((span) => span.to - span.from >= width)
    .sort((one, other) => other.to - other.from - (one.to - one.from))
}

/** How wide the room is across, which is what free-standing things are spread along. */
export function freeWidth(doc: HouseDocument, room: Room): number {
  const xs = room.nodes.map((node) => doc.nodes[node]?.x ?? 0)
  return Math.max(...xs) - Math.min(...xs)
}

function occupied(
  doc: HouseDocument,
  level: string,
  room: Room,
  side: Side,
  run: SideRun,
  layer: Layer,
): Span[] {
  // Same layer only, so a television and the console under it take the same
  // stretch of wall instead of standing side by side along it.
  const objects = Object.values(doc.objects)
    .filter(
      (object) =>
        object.room === room.id && object.against === side && layerOf(object.type) === layer,
    )
    .map((object) => spanAround(object.along * run.length, reachOf(object).across))

  const unit = {
    x: (run.to.x - run.from.x) / (run.length || 1),
    y: (run.to.y - run.from.y) / (run.length || 1),
  }
  const doors = Object.values(doc.openings)
    .filter((opening) => opening.kind === 'door' && doc.walls[opening.wall]?.level === level)
    .flatMap((opening) => {
      const wall = doc.walls[opening.wall]!
      const a = doc.nodes[wall.a]
      const b = doc.nodes[wall.b]
      if (!a || !b) return []
      const at = { x: a.x + (b.x - a.x) * opening.t, y: a.y + (b.y - a.y) * opening.t }
      const distance = (at.x - run.from.x) * unit.x + (at.y - run.from.y) * unit.y
      const off = Math.abs((at.x - run.from.x) * unit.y - (at.y - run.from.y) * unit.x)
      // Only a door in this very side's line blocks it, not one across the room.
      return off <= 1 ? [spanAround(distance, opening.width)] : []
    })

  return [...objects, ...doors]
}
