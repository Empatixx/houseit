import type { HouseDocument } from '@houseit/core/document'
import { layerOf, objectType } from '@houseit/core/object-types'
import { fitsInside } from '@houseit/geometry/fits'
import type { Room } from '@houseit/geometry/rooms'
import { footprintOf, piecesOf, reachOf, standingAt, swingOf } from '@houseit/geometry/standing'
import { boxOf, clashesAny, INSIDE_A_WALL, wallBox } from './boxes'
import type { Spot } from './place-object'

/** What a thing is and how big, which is all a check on where it stands needs. */
export type Shape = { type: string; width: number; depth: number; rotation?: number }

/**
 * What a thing really takes up: what it reaches once it is turned, plus
 * whatever it spreads past that. The same numbers are used to look for a spot
 * and to check the spot found, or the search offers places the check refuses.
 */
export function takenBy(shape: Shape): { width: number; depth: number } {
  const spread = objectType(shape.type)?.reach ?? 0
  const reach = reachOf(shape)
  return { width: reach.across + spread * 2, depth: reach.into + spread * 2 }
}

/**
 * How much of a thing has to be inside the room it belongs to.
 *
 * All of it, when it is being put down: something new that hangs out of the
 * room it was asked for is a mistake, and saying so is the whole use of the
 * check. Not when it is being carried: a chest slid towards the door reaches
 * over the threshold long before it has gone anywhere, and refusing that is
 * refusing to move it at all. What it may never do either way is stand in a
 * wall, and that is a separate question with its own answer.
 */
export type Standing = { overhang?: boolean }

/** Whether a thing can stand at a spot in a room; see `standingProblem` for why not. */
export function canStand(
  doc: HouseDocument,
  level: string,
  room: Room,
  spot: Spot,
  shape: Shape,
  except?: string,
  how: Standing = {},
): boolean {
  return standingProblem(doc, level, room, spot, shape, except, how) === undefined
}

/**
 * What is wrong with a thing standing at a spot in a room, or nothing.
 *
 * The one check, whether the thing is being put there or moved there. The spot
 * is put where the drawing would put it and then held against the room itself,
 * so nothing lands half in the room next door; against the walls, so nothing
 * sits inside the masonry; and against whatever is standing there already.
 * The thing being moved is left out of that last count — it is not in its own
 * way. What comes back is said so it can end a sentence: "…: it would stand in
 * the sectional sofa", because a drag that is refused has to say by what.
 */
export function standingProblem(
  doc: HouseDocument,
  level: string,
  room: Room,
  spot: Spot,
  shape: Shape,
  except?: string,
  how: Standing = {},
): string | undefined {
  const { width, depth, rotation } = shape
  const at = standingAt(doc, level, room, { ...spot, width, depth, rotation })
  if (!at) return `${room.name ?? 'the room'} has no wall on that side`

  const spread = objectType(shape.type)?.reach ?? 0
  const reach = reachOf(shape)
  const taken = takenBy(shape)

  // What the thing spreads past itself, it spreads into the room — never back
  // through the wall it is standing against. A bed wants half a metre either
  // side and at the foot and none at all behind the headboard, and counting
  // it behind as well is what put the bed through the bedroom wall.
  const needs = spot.against ? { width: taken.width, depth: reach.into + spread } : taken
  const forward = spot.against ? spread / 2 : 0
  const middle = {
    at: {
      x: at.at.x - Math.sin(at.turn) * forward,
      y: at.at.y + Math.cos(at.turn) * forward,
    },
    // Square to the wall, not to the thing: `needs` is already the box the
    // turned shape fills, so turning that box again counts the turn twice.
    turn: at.turn - swingOf({ rotation }),
  }
  if (!how.overhang && !fitsInside(doc, room, footprintOf(middle, needs))) {
    return `it would reach outside ${room.name ?? 'the room'}`
  }

  // And clear of the walls themselves. A room is drawn on their centre lines,
  // so a thing can sit inside the room and inside half a wall at the same
  // time — which is exactly what the bedside table did.
  //
  // Every box the thing really fills, not the one box it is cut from: the
  // corner an L-shaped kitchen wraps round is floor, and a box that takes it in
  // refuses the emptiest spot in the room.
  const boxes = piecesOf(at, { type: shape.type, width, depth }).map(boxOf)
  const buried = Object.values(doc.walls)
    .filter((wall) => wall.level === level)
    .some((wall) => {
      const from = doc.nodes[wall.a]
      const to = doc.nodes[wall.b]
      return (
        from !== undefined &&
        to !== undefined &&
        clashesAny(boxes, [wallBox(from, to, wall.thickness)], INSIDE_A_WALL)
      )
    })
  if (buried) return 'it would stand in a wall'

  // And clear of whatever is already standing there. Keeping to the free
  // stretches of one wall was never the whole job: a wall has two ends, and
  // each of them is a corner it shares with the wall round it — which is how
  // an armchair at the west wall ended up sitting in the sofa.
  const layer = layerOf(shape.type)
  const inTheWay = Object.values(doc.objects)
    .filter(
      (other) =>
        other.id !== except &&
        other.room === room.id &&
        other.level === level &&
        layerOf(other.type) === layer,
    )
    .find((other) => {
      const stood = standingAt(doc, level, room, other)
      return stood !== undefined && clashesAny(boxes, piecesOf(stood, other).map(boxOf))
    })
  if (inTheWay) {
    return `it would stand in the ${objectType(inTheWay.type)?.label.toLowerCase() ?? inTheWay.type}`
  }
  return undefined
}
