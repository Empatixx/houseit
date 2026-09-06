import type { HouseDocument, Wall } from '@houseit/core/document'
import type { Room } from './rooms'

export function boundaryWallsOf(doc: HouseDocument, level: string, room: Room): Wall[] {
  const seen = new Set<string>()
  const walls: Wall[] = []

  for (let i = 0; i < room.nodes.length; i += 1) {
    const wall = wallBetween(doc, level, room.nodes[i]!, room.nodes[(i + 1) % room.nodes.length]!)
    if (!wall || seen.has(wall.id)) continue
    seen.add(wall.id)
    walls.push(wall)
  }

  return walls
}

export function wallBetween(
  doc: HouseDocument,
  level: string,
  a: string,
  b: string,
): Wall | undefined {
  return Object.values(doc.walls).find(
    (wall) =>
      wall.level === level && ((wall.a === a && wall.b === b) || (wall.a === b && wall.b === a)),
  )
}
