import type { HouseDocument } from '@houseit/core/document'
import type { Point } from './outlines'
import type { Room } from './rooms'

/**
 * Whether a shape lies wholly inside a room.
 *
 * Both halves are needed. Corners alone pass a table laid across the waist of an
 * L-shaped room — all four of them can be inside while the middle of it hangs out
 * over the neighbour. Crossings alone pass a table sitting entirely outside a
 * room it never touches.
 */
export function fitsInside(doc: HouseDocument, room: Room, shape: Point[]): boolean {
  const walls = room.nodes.map((node) => doc.nodes[node]).filter((node) => node !== undefined)
  if (walls.length < 3 || shape.length < 3) return false

  const tested = shrink(shape, TOUCHING)
  if (!tested.every((corner) => contains(walls, corner))) return false

  for (let i = 0; i < walls.length; i += 1) {
    const from = walls[i]!
    const to = walls[(i + 1) % walls.length]!
    for (let j = 0; j < tested.length; j += 1) {
      if (crosses(from, to, tested[j]!, tested[(j + 1) % tested.length]!)) return false
    }
  }
  return true
}

/**
 * How far a shape is pulled in before it is tested, in millimetres.
 *
 * Furniture is put flush against things — that is where furniture goes — and a
 * corner sitting exactly on a wall is neither in nor out as far as ray casting is
 * concerned. A hair's width settles it in favour of touching, and it is far too
 * small to let anything actually overlap through.
 */
const TOUCHING = 1

function shrink(shape: Point[], by: number): Point[] {
  const middle = shape.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), {
    x: 0,
    y: 0,
  })
  const centre = { x: middle.x / shape.length, y: middle.y / shape.length }

  return shape.map((corner) => {
    const away = Math.hypot(corner.x - centre.x, corner.y - centre.y) || 1
    const pull = Math.min(by, away / 2) / away
    return {
      x: corner.x + (centre.x - corner.x) * pull,
      y: corner.y + (centre.y - corner.y) * pull,
    }
  })
}

/** Ray casting, written out because a face may repeat a vertex where a wall dangles. */
function contains(polygon: Point[], point: Point): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]!
    const b = polygon[j]!
    const straddles = a.y > point.y !== b.y > point.y
    if (straddles && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

/** Whether two segments properly cross, rather than merely touching end to end. */
function crosses(a: Point, b: Point, c: Point, d: Point): boolean {
  const side = (p: Point, q: Point, r: Point) =>
    Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x))

  const one = side(a, b, c)
  const other = side(a, b, d)
  const third = side(c, d, a)
  const fourth = side(c, d, b)

  return one !== other && third !== fourth && one !== 0 && other !== 0
}
