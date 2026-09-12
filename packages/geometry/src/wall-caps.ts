import type { HouseDocument, Wall } from '@houseit/core/document'

export function wallCaps(doc: HouseDocument, wall: Wall) {
  const a = doc.nodes[wall.a]!,
    b = doc.nodes[wall.b]!
  const dx = b.x - a.x,
    dy = b.y - a.y
  const span = Math.hypot(dx, dy)
  const at = (node: string) => {
    let reach = 0
    for (const other of Object.values(doc.walls)) {
      if (
        other.id === wall.id ||
        other.level !== wall.level ||
        (other.a !== node && other.b !== node)
      )
        continue
      const p = doc.nodes[other.a]!,
        q = doc.nodes[other.b]!
      const length = Math.hypot(q.x - p.x, q.y - p.y)
      const sine = Math.abs(dx * (q.y - p.y) - dy * (q.x - p.x)) / (span * length)
      if (sine > 0.01) reach = Math.max(reach, other.thickness / (2 * sine))
    }
    return reach
  }
  return { growA: at(wall.a), growB: at(wall.b) }
}
