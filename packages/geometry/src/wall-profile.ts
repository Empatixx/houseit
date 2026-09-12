import type { HouseDocument, Wall } from '@houseit/core/document'
import { soffitOf } from '@houseit/core/levels'
import type { Point } from './outlines'

const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x

export function wallProfile(doc: HouseDocument, wall: Wall, atHeight?: number): Point[] {
  const a = doc.nodes[wall.a]!
  const b = doc.nodes[wall.b]!
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  if (length === 0) throw new Error(`Wall ${wall.id} has no length`)
  const end = (nodeId: string, far: Point) => {
    const at = doc.nodes[nodeId]!
    const u = { x: (far.x - at.x) / length, y: (far.y - at.y) / length }
    const others = Object.values(doc.walls)
      .filter(
        (w) => w.id !== wall.id && w.level === wall.level && (w.a === nodeId || w.b === nodeId),
      )
      .filter(
        (w) =>
          atHeight === undefined ||
          (w.baseOffset <= atHeight &&
            Math.min(w.baseOffset + w.height, soffitOf(doc.levels[w.level]!)) > atHeight),
      )
      .map((w) => {
        const p = doc.nodes[w.a === nodeId ? w.b : w.a]!
        const size = Math.hypot(p.x - at.x, p.y - at.y)
        const v = { x: (p.x - at.x) / size, y: (p.y - at.y) / size }
        const angle = (Math.atan2(cross(u, v), u.x * v.x + u.y * v.y) + Math.PI * 2) % (Math.PI * 2)
        return { wall: w, v, angle }
      })
      .sort((one, two) => one.angle - two.angle)
    const edge = (side: 1 | -1): Point => {
      const p = { x: (-u.y * side * wall.thickness) / 2, y: (u.x * side * wall.thickness) / 2 }
      const other = side === 1 ? others[0] : others.at(-1)
      if (!other || Math.abs(cross(u, other.v)) < 1e-6) return { x: at.x + p.x, y: at.y + p.y }
      const q = {
        x: (other.v.y * side * other.wall.thickness) / 2,
        y: (-other.v.x * side * other.wall.thickness) / 2,
      }
      const distance = cross({ x: q.x - p.x, y: q.y - p.y }, other.v) / cross(u, other.v)
      if (Math.abs(distance) > length / 2)
        throw new Error(`Wall ${wall.id} is too short for its junction`)
      return { x: at.x + p.x + u.x * distance, y: at.y + p.y + u.y * distance }
    }
    return {
      left: edge(1),
      right: edge(-1),
      centre: others.length > 1 ? [{ x: at.x, y: at.y }] : [],
    }
  }
  const start = end(wall.a, b)
  const finish = end(wall.b, a)
  return [start.right, finish.left, ...finish.centre, finish.right, start.left, ...start.centre]
}
