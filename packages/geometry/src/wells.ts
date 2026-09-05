import type { HouseDocument, HouseObject } from '@houseit/core/document'
import { levelBelow } from '@houseit/core/levels'
import { isStaircase } from '@houseit/core/stairs'
import type { Point } from './outlines'
import { containsPoint, type Room, roomsOf } from './rooms'
import { footprintOf, standingAt } from './standing'

/**
 * The holes a staircase makes in the floor above it.
 *
 * A flight of stairs is not furniture standing in a room: it is a way out of
 * the room, upwards, and the floor overhead has to be missing where it comes
 * through or the top of it meets a ceiling. So the well is not a thing anybody
 * draws or stores — it is the staircase itself, seen from the storey above.
 *
 * Derived rather than written down, which is the same reason rooms are: two
 * records of one hole is one record too many, and the second is the one that
 * ends up wrong.
 */
export type Well = {
  /** The staircase it belongs to, on the storey below. */
  object: string
  type: string
  /** Its footprint, which is the hole, in plan millimetres. */
  outline: Point[]
}

/** Every staircase on a storey, with the shape it takes on the floor. */
export function stairwaysOn(doc: HouseDocument, level: string): Well[] {
  const rooms = new Map(
    roomsOf(doc, level)
      .filter((room) => room.id)
      .map((room) => [room.id!, room] as const),
  )

  return Object.values(doc.objects).flatMap((object: HouseObject) => {
    if (object.level !== level || !isStaircase(object.type)) return []
    const room = rooms.get(object.room)
    const spot = room ? standingAt(doc, level, room, object) : undefined
    if (!spot) return []
    return [{ object: object.id, type: object.type, outline: footprintOf(spot, object) }]
  })
}

/**
 * The holes in this storey's floor: the staircases on the storey underneath,
 * coming up through it. Nothing on the lowest floor, which stands on the ground.
 */
export function wellsIn(doc: HouseDocument, level: string): Well[] {
  const under = levelBelow(doc, level)
  return under ? stairwaysOn(doc, under.id) : []
}

/**
 * The holes in one room's floor.
 *
 * The one place that decides whether a well belongs to a room, so the floor
 * drawn with a hole in it and the room that says it has one can never disagree
 * — which is how a hole came to be reported and not drawn.
 *
 * A well counts as this room's when its middle is inside it. Testing every
 * corner instead loses a stairwell tucked into a corner, where the flight's
 * back face and the wall's are the same line.
 */
export function wellsInRoom(doc: HouseDocument, level: string, room: Room): Well[] {
  const outline = room.nodes.map((id) => doc.nodes[id]).filter((node) => node !== undefined)
  if (outline.length < 3) return []
  return wellsIn(doc, level).filter((well) => {
    const middle = well.outline.reduce(
      (total, corner) => ({ x: total.x + corner.x / 4, y: total.y + corner.y / 4 }),
      { x: 0, y: 0 },
    )
    return containsPoint(outline, middle.x, middle.y)
  })
}
