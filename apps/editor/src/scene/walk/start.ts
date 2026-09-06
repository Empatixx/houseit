import type { HouseDocument } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import { containsPoint, roomsOf } from '@houseit/geometry/rooms'
import { piecesOf, standingAt } from '@houseit/geometry/standing'
import { yawTowards } from '../../store/walk'

const ELBOW = 500

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

function within(piece: Point[], at: Point, margin: number): boolean {
  const box = boxOf(piece)
  return (
    at.x > box.x0 - margin &&
    at.x < box.x1 + margin &&
    at.y > box.y0 - margin &&
    at.y < box.y1 + margin
  )
}

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
