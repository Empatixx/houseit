import type { HouseDocument } from '@houseit/core/document'
import type { Point } from './outlines'
import type { Room } from './rooms'

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

function crosses(a: Point, b: Point, c: Point, d: Point): boolean {
  const side = (p: Point, q: Point, r: Point) =>
    Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x))

  const one = side(a, b, c)
  const other = side(a, b, d)
  const third = side(c, d, a)
  const fourth = side(c, d, b)

  return one !== other && third !== fourth && one !== 0 && other !== 0
}
