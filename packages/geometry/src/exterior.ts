import type { HouseDocument } from '@houseit/core/document'
import { findFaces } from '@houseit/core/faces'

export function exteriorSides(doc: HouseDocument, level: string): Map<string, 1 | -1> {
  const owners = new Map<string, (1 | -1)[]>()
  for (const face of findFaces(doc, level)) {
    face.walls.forEach((id, index) => {
      const wall = doc.walls[id]!
      const side = wall.a === face.nodes[index] ? -1 : 1
      owners.set(id, [...(owners.get(id) ?? []), side])
    })
  }
  return new Map(
    [...owners].flatMap(([id, sides]) => (sides.length === 1 ? [[id, sides[0]!]] : [])),
  )
}
