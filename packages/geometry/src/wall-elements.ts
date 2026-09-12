import type { HouseDocument, Wall } from '@houseit/core/document'

export const elementId = (wall: Wall) => wall.element ?? wall.id

export function elementWalls(doc: HouseDocument, id: string): Wall[] {
  const key = doc.walls[id] ? elementId(doc.walls[id]!) : id
  return Object.values(doc.walls).filter((wall) => elementId(wall) === key)
}

export function wallElement(doc: HouseDocument, id: string) {
  const walls = elementWalls(doc, id)
  if (!walls.length) throw new Error(`Unknown wall ${id}`)
  const ends = new Set(walls.map((w) => w.b))
  const starts = walls.filter((w) => !ends.has(w.a))
  const byStart = new Map(walls.map((w) => [w.a, w]))
  if (starts.length !== 1 || byStart.size !== walls.length)
    throw new Error(`Wall ${id} must be one continuous, ordered run`)
  const chain: Wall[] = []
  let current: Wall | undefined = starts[0]
  const visited = new Set<string>()
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    chain.push(current)
    current = byStart.get(current.b)
  }
  if (current || chain.length !== walls.length)
    throw new Error(`Wall ${id} must be one continuous, ordered run`)
  const first = chain[0]!,
    last = chain[chain.length - 1]!
  const from = doc.nodes[first.a]!,
    to = doc.nodes[last.b]!
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  if (length < 1) throw new Error(`Wall ${id} has no length`)
  const unit = { x: (to.x - from.x) / length, y: (to.y - from.y) / length }
  const project = (node: string) => {
    const p = doc.nodes[node]!
    if (Math.abs((p.x - from.x) * unit.y - (p.y - from.y) * unit.x) > 1.5)
      throw new Error(`Wall ${id} must stay straight`)
    return (p.x - from.x) * unit.x + (p.y - from.y) * unit.y
  }
  const segments = chain.map((wall) => {
    if (wall.level !== first.level) throw new Error(`Wall ${id} cannot span storeys`)
    const start = project(wall.a),
      end = project(wall.b)
    if (end - start < 1) throw new Error(`Wall ${id} must be one continuous, ordered run`)
    return { wall, from: start, to: end }
  })
  return { id: elementId(first), level: first.level, from, to, length, unit, segments }
}
