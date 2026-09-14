import type { HouseDocument } from '@houseit/core/document'
import { roomKindOf } from '@houseit/core/room-kinds'
import { type Room, roomsOf } from './rooms'

export type Enclosure = 'wall' | 'glass' | 'edge'

const STRENGTH: Record<Enclosure, number> = { edge: 0, glass: 1, wall: 2 }

export const isOutdoor = (room: { name?: string; kind?: string }): boolean =>
  roomKindOf(room)?.outdoor === true

function shelterOf(room: Room): Enclosure {
  const kind = roomKindOf(room)
  if (kind?.outdoor) return 'edge'
  if (kind?.glazed) return 'glass'
  return 'wall'
}

export function enclosuresOf(
  doc: HouseDocument,
  level: string,
  rooms: Room[] = roomsOf(doc, level),
): Map<string, Enclosure> {
  const found = new Map<string, Enclosure>()
  for (const room of rooms) {
    const own = shelterOf(room)
    for (const wall of room.walls) {
      const before = found.get(wall)
      if (before === undefined || STRENGTH[own] > STRENGTH[before]) found.set(wall, own)
    }
  }
  return found
}

export const enclosureOf = (found: Map<string, Enclosure>, wall: string): Enclosure =>
  found.get(wall) ?? 'wall'
