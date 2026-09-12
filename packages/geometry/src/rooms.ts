import type { HouseDocument } from '@houseit/core/document'
import { type Face, findFaces } from '@houseit/core/faces'
import { areaInBox, disjointBoxes } from './area-in-box'
import { centroidOf } from './centroid'
import { clearAreaOf, clearOutline } from './clear'
import { shaftsOn } from './connections'

import type { Point } from './outlines'

export type Room = Face & {
  clear: number
  centre: Point
  id?: string
  name?: string
  floor?: string
  kind?: string
}

export function roomsOf(doc: HouseDocument, level: string): Room[] {
  const stored = Object.values(doc.rooms).filter((room) => room.level === level)
  const shafts = shaftsOn(doc, level)
  const occupied = disjointBoxes([
    ...(doc.levels[level]?.columns ?? []).map((c) => ({
      x0: c.x - c.width / 2,
      x1: c.x + c.width / 2,
      y0: c.y - c.depth / 2,
      y1: c.y + c.depth / 2,
    })),
    ...shafts
      .filter((s) => s.enclosure)
      .map((s) => ({
        x0: s.x - s.width / 2 - s.enclosure!.thickness,
        x1: s.x + s.width / 2 + s.enclosure!.thickness,
        y0: s.y - s.depth / 2 - s.enclosure!.thickness,
        y1: s.y + s.depth / 2 + s.enclosure!.thickness,
      })),
  ])

  return findFaces(doc, level)
    .map((face) => {
      const polygon = face.nodes.map((id) => doc.nodes[id]!)
      const walls = new Set(face.walls)
      const found =
        stored.find(
          (candidate) =>
            candidate.loop.length === walls.size && candidate.loop.every((id) => walls.has(id)),
        ) ?? stored.find((candidate) => containsPoint(polygon, candidate.x, candidate.y))
      const clear = clearOutline(doc, level, face.nodes)
      // Existing room walls may already enclose a declared shaft. That void is
      // not an unassigned room. Preserve named rooms and all other small faces.
      if (
        !found &&
        clear.length &&
        shafts.some(
          (s) =>
            s.enclosure &&
            clear.every(
              (p) =>
                p.x >= s.x - s.width / 2 - 0.5 &&
                p.x <= s.x + s.width / 2 + 0.5 &&
                p.y >= s.y - s.depth / 2 - 0.5 &&
                p.y <= s.y + s.depth / 2 + 0.5,
            ),
        )
      )
        return undefined
      const room: Room = {
        ...face,
        clear:
          clearAreaOf(doc, level, face.nodes) -
          occupied.reduce((sum, box) => sum + areaInBox(clear, box), 0),
        centre: centroidOf(polygon, face.area),
      }
      return found
        ? { ...room, id: found.id, name: found.name, floor: found.floor, kind: found.kind }
        : room
    })
    .filter((room): room is Room => room !== undefined)
}

export function containsPoint(polygon: { x: number; y: number }[], x: number, y: number): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]!
    const b = polygon[j]!
    const straddles = a.y > y !== b.y > y
    if (!straddles) continue
    const crossingX = a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y)
    if (x < crossingX) inside = !inside
  }
  return inside
}
