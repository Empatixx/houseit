import type { HouseDocument } from '@houseit/core/document'
import { layerOf, objectType } from '@houseit/core/object-types'
import { fitsInside } from '@houseit/geometry/fits'
import type { Room } from '@houseit/geometry/rooms'
import { footprintOf, reachOf, standingAt, swingOf } from '@houseit/geometry/standing'
import { boxOf, clashes, INSIDE_A_WALL, wallBox } from './boxes'
import type { Spot } from './place-object'

/** What a thing is and how big, which is all a check on where it stands needs. */
export type Shape = { type: string; width: number; depth: number; turn?: number }

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

/** Whether a thing can stand at a spot in a room; see `standingProblem` for why not. */
export function canStand(
  doc: HouseDocument,
  level: string,
  room: Room,
  spot: Spot,
  shape: Shape,
  except?: string,
): boolean {
  return standingProblem(doc, level, room, spot, shape, except) === undefined
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
): string | undefined {
  const { width, depth, turn } = shape
  const at = standingAt(doc, level, room, { ...spot, width, depth, turn })
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
    turn: at.turn - swingOf({ turn }),
  }
  if (!fitsInside(doc, room, footprintOf(middle, needs))) {
    return `it would reach outside ${room.name ?? 'the room'}`
  }

  // And clear of the walls themselves. A room is drawn on their centre lines,
  // so a thing can sit inside the room and inside half a wall at the same
  // time — which is exactly what the bedside table did.
  const box = boxOf(footprintOf(at, { width, depth }))
  const buried = Object.values(doc.walls)
    .filter((wall) => wall.level === level)
    .some((wall) => {
      const from = doc.nodes[wall.a]
      const to = doc.nodes[wall.b]
      return (
        from !== undefined &&
        to !== undefined &&
        clashes(box, wallBox(from, to, wall.thickness), INSIDE_A_WALL)
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
      return stood !== undefined && clashes(box, boxOf(footprintOf(stood, other)))
    })
  if (inTheWay) {
    return `it would stand in the ${objectType(inTheWay.type)?.label.toLowerCase() ?? inTheWay.type}`
  }
  return undefined
}
