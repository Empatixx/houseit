import type { HouseDocument } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import { containsPoint, roomsOf } from '@houseit/geometry/rooms'
import { piecesOf, standingAt } from '@houseit/geometry/standing'
import { yawTowards } from '../../store/walk'

/**
 * Where a walk starts, and which way it faces.
 *
 * In the biggest room, on floor nobody has put anything on, looking in towards
 * the middle of it. The room's anchor is where its label hangs, which is the
 * middle of the room and therefore under the table as often as not — start
 * there and the walk opens inside the kitchen run or standing in the bed, with
 * a wall filling the view, which reads as the whole thing being broken rather
 * than as standing somewhere silly.
 */

/** Room enough round somebody to stand in without being inside the furniture. */
const ELBOW = 500

/** How finely the room is tried for a clear spot: coarse, since this only opens a view. */
const STEPS = 9

export type Start = { at: Point; yaw: number }

export function startOf(doc: HouseDocument, level: string): Start | undefined {
  const rooms = roomsOf(doc, level)
  if (rooms.length === 0) return undefined
  const biggest = rooms.reduce((best, next) => (next.area > best.area ? next : best))

  const outline = biggest.nodes.map((node) => doc.nodes[node]).filter((node) => node !== undefined)
  if (outline.length < 3) return undefined
  const stored = biggest.id ? doc.rooms[biggest.id] : undefined
  const middle = stored ? { x: stored.x, y: stored.y } : biggest.centre

  // Every box everything in the room stands on, to keep out of.
  const taken = Object.values(doc.objects).flatMap((object) => {
    if (object.level !== level || object.room !== biggest.id) return []
    const spot = standingAt(doc, level, biggest, object)
    return spot ? piecesOf(spot, object) : []
  })

  const clear = (at: Point) =>
    containsPoint(outline, at.x, at.y) && taken.every((piece) => !within(piece, at, ELBOW))

  const at = clear(middle) ? middle : (roomiest(outline, taken, clear) ?? middle)
  return { at, yaw: yawTowards(at, middle) }
}

/**
 * The clear spot with the most room round it, out of a grid of them.
 *
 * Every one is tried and the roomiest kept rather than the first taken, so the
 * walk opens in the middle of the floor and not wedged behind the door.
 */
function roomiest(
  outline: Point[],
  taken: Point[][],
  clear: (at: Point) => boolean,
): Point | undefined {
  const xs = outline.map((corner) => corner.x)
  const ys = outline.map((corner) => corner.y)
  const box = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }

  let best: { at: Point; room: number } | undefined
  for (let across = 1; across < STEPS; across += 1) {
    for (let along = 1; along < STEPS; along += 1) {
      const at = {
        x: box.x0 + ((box.x1 - box.x0) * across) / STEPS,
        y: box.y0 + ((box.y1 - box.y0) * along) / STEPS,
      }
      if (!clear(at)) continue
      const room = taken.reduce((least, piece) => Math.min(least, clearanceOf(piece, at)), Infinity)
      if (!best || room > best.room) best = { at, room }
    }
  }
  return best?.at
}

/** Whether a point is in a box, counting a margin round it as in it. */
function within(piece: Point[], at: Point, margin: number): boolean {
  const box = boxOf(piece)
  return (
    at.x > box.x0 - margin &&
    at.x < box.x1 + margin &&
    at.y > box.y0 - margin &&
    at.y < box.y1 + margin
  )
}

/** How far a point is from a box, and nothing at all when it is inside one. */
function clearanceOf(piece: Point[], at: Point): number {
  const box = boxOf(piece)
  return Math.hypot(
    Math.max(box.x0 - at.x, 0, at.x - box.x1),
    Math.max(box.y0 - at.y, 0, at.y - box.y1),
  )
}

const boxOf = (piece: Point[]) => ({
  x0: Math.min(...piece.map((corner) => corner.x)),
  y0: Math.min(...piece.map((corner) => corner.y)),
  x1: Math.max(...piece.map((corner) => corner.x)),
  y1: Math.max(...piece.map((corner) => corner.y)),
})
