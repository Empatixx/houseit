import type { HouseDocument, Wall } from '@houseit/core/document'
import type { Room } from './rooms'

/**
 * The walls that bound a room, in the order the face walks them.
 *
 * A face is a ring of nodes, not of walls, so the walls have to be looked back
 * up from consecutive pairs. A wall that dangles into the room is walked twice,
 * once in each direction, and is listed only once.
 */
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
