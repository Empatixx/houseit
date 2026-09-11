import type { HouseDocument } from './document'
import { findFaces } from './faces'

export function loopsFor(doc: HouseDocument, level: string): Map<string, string[]> {
  const loops = new Map<string, string[]>()
  const rooms = Object.values(doc.rooms).filter((room) => room.level === level)

  for (const face of findFaces(doc, level)) {
    const polygon = face.nodes.map((id) => doc.nodes[id]!)
    for (const room of rooms) {
      if (loops.has(room.id)) continue
      if (inside(polygon, room.x, room.y)) loops.set(room.id, face.walls)
    }
  }

  return loops
}

function inside(polygon: { x: number; y: number }[], x: number, y: number): boolean {
  let within = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const one = polygon[i]!
    const other = polygon[j]!
    const straddles = one.y > y !== other.y > y
    if (!straddles) continue
    const at = ((other.x - one.x) * (y - one.y)) / (other.y - one.y) + one.x
    if (x < at) within = !within
  }
  return within
}
