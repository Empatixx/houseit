import type { HouseDocument, Wall } from '@houseit/core/document'
import type { Room } from './rooms'

export function boundaryWallsOf(doc: HouseDocument, level: string, room: Room): Wall[] {
  const seen = new Set<string>()
  const walls: Wall[] = []

  const between = wallLookup(doc, level)
  for (let i = 0; i < room.nodes.length; i += 1) {
    const wall = between(room.nodes[i]!, room.nodes[(i + 1) % room.nodes.length]!)
    if (!wall || seen.has(wall.id)) continue
    seen.add(wall.id)
    walls.push(wall)
  }

  return walls
}

const indexes = new WeakMap<HouseDocument['walls'], Map<string, Wall>>()
const pair = (level: string, a: string, b: string) =>
  a < b ? `${level}|${a}|${b}` : `${level}|${b}|${a}`

function indexOf(doc: HouseDocument): Map<string, Wall> {
  const known = indexes.get(doc.walls)
  if (known) return known
  const index = new Map<string, Wall>()
  for (const wall of Object.values(doc.walls)) {
    const key = pair(wall.level, wall.a, wall.b)
    if (!index.has(key)) index.set(key, wall)
  }
  if (Object.isFrozen(doc.walls)) indexes.set(doc.walls, index)
  return index
}

export function wallLookup(doc: HouseDocument, level: string) {
  const index = indexOf(doc)
  return (a: string, b: string): Wall | undefined => index.get(pair(level, a, b))
}

export function wallBetween(
  doc: HouseDocument,
  level: string,
  a: string,
  b: string,
): Wall | undefined {
  if (Object.isFrozen(doc.walls)) return indexOf(doc).get(pair(level, a, b))
  return Object.values(doc.walls).find(
    (wall) =>
      wall.level === level && ((wall.a === a && wall.b === b) || (wall.a === b && wall.b === a)),
  )
}
