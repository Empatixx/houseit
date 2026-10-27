import type { HouseDocument } from '@houseit/core/document'
import { EndType, FillRule, inflatePaths, JoinType, union } from 'clipper2-ts'
import { isOutdoor } from './enclosure'
import type { Point } from './outlines'
import { roomsOf } from './rooms'

export function storeyOutline(doc: HouseDocument, level: string): Point[] | undefined {
  const rooms = roomsOf(doc, level).filter((room) => !isOutdoor(room))
  const paths = rooms.map((room) =>
    room.nodes.map((id) => doc.nodes[id]!).map((node) => ({ x: node.x, y: node.y })),
  )
  if (paths.length === 0) return undefined
  const walls = Object.values(doc.walls).filter((wall) => wall.level === level)
  const half = Math.max(0, ...walls.map((wall) => wall.thickness)) / 2
  const merged = union(paths, FillRule.NonZero)
  const outer = inflatePaths(merged, half, JoinType.Miter, EndType.Polygon, 4)
  const largest = outer.reduce<Point[] | undefined>((best, path) => {
    const size = Math.abs(area(path))
    return !best || size > Math.abs(area(best)) ? path : best
  }, undefined)
  if (!largest) return undefined
  const rounded = largest.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }))
  return rounded.filter((p, i) => {
    const before = rounded[(i - 1 + rounded.length) % rounded.length]!
    const after = rounded[(i + 1) % rounded.length]!
    return (before.x - p.x) * (after.y - p.y) !== (before.y - p.y) * (after.x - p.x)
  })
}

const area = (ring: Point[]) =>
  ring.reduce((sum, a, i) => {
    const b = ring[(i + 1) % ring.length]!
    return sum + a.x * b.y - b.x * a.y
  }, 0) / 2
