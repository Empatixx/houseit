import type { HouseDocument, Wall } from '@houseit/core/document'

export const elementId = (wall: Wall) => wall.element ?? wall.id

export function elementWalls(doc: HouseDocument, id: string): Wall[] {
  const key = doc.walls[id] ? elementId(doc.walls[id]!) : id
  return Object.values(doc.walls).filter((wall) => elementId(wall) === key)
}

export function wallElement(doc: HouseDocument, id: string) {
  const walls = elementWalls(doc, id)
  const first = walls[0]
  if (!first) throw new Error(`Unknown wall ${id}`)
  const origin = doc.nodes[first.a]!
  const end = doc.nodes[first.b]!
  const span = Math.hypot(end.x - origin.x, end.y - origin.y)
  if (span < 1) throw new Error(`Wall ${id} has no length`)
  const unit = { x: (end.x - origin.x) / span, y: (end.y - origin.y) / span }
  const project = (node: string) => {
    const p = doc.nodes[node]!
    if (Math.abs((p.x - origin.x) * unit.y - (p.y - origin.y) * unit.x) > 1)
      throw new Error(`Wall ${id} must stay straight`)
    return (p.x - origin.x) * unit.x + (p.y - origin.y) * unit.y
  }
  const segments = walls
    .map((wall) => {
      if (wall.level !== first.level) throw new Error(`Wall ${id} cannot span storeys`)
      return { wall, from: project(wall.a), to: project(wall.b) }
    })
    .sort((a, b) => a.from - b.from)
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!
    if (segment.to <= segment.from || (i > 0 && Math.abs(segment.from - segments[i - 1]!.to) > 1))
      throw new Error(`Wall ${id} must be one continuous, ordered run`)
  }
  const start = segments[0]!
  const finish = segments[segments.length - 1]!
  return {
    id: elementId(first),
    level: first.level,
    unit,
    from: doc.nodes[start.wall.a]!,
    to: doc.nodes[finish.wall.b]!,
    length: finish.to - start.from,
    segments: segments.map((s) => ({ ...s, from: s.from - start.from, to: s.to - start.from })),
  }
}
