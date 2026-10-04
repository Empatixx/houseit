import type { HouseDocument } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import { containsPoint, roomsOf } from '@houseit/geometry/rooms'
import { piecesOf, standingAt } from '@houseit/geometry/standing'
import { yawTowards } from '../../store/walk'
import { type Start, startOf } from './start'

const PAST_THE_FACE = 120
const INTO = 900
const SMALL = 8e6

export type Visited = { kind: 'room' | 'object' | 'opening'; id: string; room?: string }

export function visitOf(doc: HouseDocument, level: string, thing: Visited): Start | undefined {
  if (thing.kind === 'room')
    return throughDoor(doc, level, thing.id) ?? startOf(doc, level, { room: thing.id })
  const room = thing.room ?? (thing.kind === 'object' ? doc.objects[thing.id]?.room : undefined)
  if (room === undefined) return undefined
  return startOf(doc, level, { room, face: whereIs(doc, level, thing, room) })
}

function whereIs(
  doc: HouseDocument,
  level: string,
  thing: Visited,
  room: string,
): Point | undefined {
  if (thing.kind === 'opening') {
    const opening = doc.openings[thing.id]
    const wall = opening ? doc.walls[opening.wall] : undefined
    const a = wall ? doc.nodes[wall.a] : undefined
    const b = wall ? doc.nodes[wall.b] : undefined
    if (!opening || !a || !b) return undefined
    return { x: a.x + (b.x - a.x) * opening.t, y: a.y + (b.y - a.y) * opening.t }
  }
  const object = doc.objects[thing.id]
  const face = roomsOf(doc, level).find((candidate) => candidate.id === room)
  if (!object || !face) return undefined
  const spot = standingAt(doc, level, face, object)
  if (!spot) return undefined
  const corners = piecesOf(spot, object).flat()
  if (corners.length === 0) return undefined
  return {
    x: corners.reduce((sum, corner) => sum + corner.x, 0) / corners.length,
    y: corners.reduce((sum, corner) => sum + corner.y, 0) / corners.length,
  }
}

function throughDoor(doc: HouseDocument, level: string, id: string): Start | undefined {
  const room = roomsOf(doc, level).find((face) => face.id === id)
  if (!room) return undefined
  const outline = room.nodes.map((node) => doc.nodes[node]!).filter(Boolean)
  const doors = Object.values(doc.openings).filter(
    (opening) => opening.kind === 'door' && room.walls.includes(opening.wall),
  )
  for (const door of doors.sort((a, b) => b.width - a.width)) {
    const wall = doc.walls[door.wall]
    const a = wall ? doc.nodes[wall.a] : undefined
    const b = wall ? doc.nodes[wall.b] : undefined
    if (!a || !b) continue
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const latch = ((door.hinge === 'a' ? 1 : -1) * door.width) / 4 / length
    const along = door.t + latch
    const on = { x: a.x + (b.x - a.x) * along, y: a.y + (b.y - a.y) * along }
    const normal = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length }
    for (const side of [1, -1]) {
      const step = room.area < SMALL ? wall!.thickness / 2 + PAST_THE_FACE : INTO
      const at = { x: on.x + normal.x * side * step, y: on.y + normal.y * side * step }
      if (containsPoint(outline, at.x, at.y)) return { at, yaw: yawTowards(at, room.centre) }
    }
  }
  return undefined
}
