import type { HouseDocument } from '@houseit/core/document'
import { wallBetween } from './boundary'
import type { Point } from './outlines'
import type { Room } from './rooms'

export type Axis = 'x' | 'y'

export type Crossing = {
  point: Point
  wall: string
}

export function crossingsOf(
  doc: HouseDocument,
  level: string,
  room: Room,
  axis: Axis,
  at: number,
): Crossing[] {
  const across: Axis = axis === 'x' ? 'y' : 'x'
  const crossings: Crossing[] = []

  for (let i = 0; i < room.nodes.length; i += 1) {
    const from = doc.nodes[room.nodes[i]!]
    const to = doc.nodes[room.nodes[(i + 1) % room.nodes.length]!]
    if (!from || !to) continue

    const straddles = from[axis] < at !== to[axis] < at && from[axis] !== to[axis]
    if (!straddles) continue

    const ratio = (at - from[axis]) / (to[axis] - from[axis])
    const other = Math.round(from[across] + ratio * (to[across] - from[across]))
    const point = (axis === 'x' ? { x: at, y: other } : { x: other, y: at }) as Point

    const wall = wallBetween(doc, level, room.nodes[i]!, room.nodes[(i + 1) % room.nodes.length]!)
    if (wall) crossings.push({ point, wall: wall.id })
  }

  return crossings
}
