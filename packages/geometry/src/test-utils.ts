import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'

export type WallSpec = [x1: number, y1: number, x2: number, y2: number]

export function planWith(walls: WallSpec[]): { doc: HouseDocument; level: string } {
  const doc = createEmptyDocument()
  const level = Object.keys(doc.levels)[0]!
  const nodeIds = new Map<string, string>()

  const nodeAt = (x: number, y: number) => {
    const key = `${x},${y}`
    const existing = nodeIds.get(key)
    if (existing) return existing
    const id = `n${nodeIds.size + 1}`
    nodeIds.set(key, id)
    doc.nodes[id] = { id, x, y }
    return id
  }

  walls.forEach(([x1, y1, x2, y2], index) => {
    const id = `w${index + 1}`
    doc.walls[id] = {
      id,
      level,
      a: nodeAt(x1, y1),
      b: nodeAt(x2, y2),
      thickness: 150,
      baseOffset: 0,
      height: 2600,
    }
  })

  return { doc, level }
}

export const areasOf = (faces: { area: number }[]) => faces.map((f) => f.area).sort((a, b) => a - b)
