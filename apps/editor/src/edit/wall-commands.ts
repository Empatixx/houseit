import { removeRoom } from '@houseit/commands/remove-room'
import { surveyRoom } from '@houseit/commands/survey'
import { updateRoom } from '@houseit/commands/update-room'
import { removeWall, updateWall } from '@houseit/commands/wall'
import type { Wall } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { documentStore } from '../store/store'
import { sayError } from './notice'
import { endPreview, previewCommand } from './preview'
import { roomRef } from './room-ref'
import { runEdit } from './run-edit'
import { wallMoveArgsOf, wallNamedBy } from './wall-move'

function wallMoveArgs(wall: Wall, shift: Point) {
  const { doc } = documentStore.getState()
  const a = doc.nodes[wall.a]!,
    b = doc.nodes[wall.b]!
  const span = Math.hypot(b.x - a.x, b.y - a.y)
  return {
    id: wall.element ?? wall.id,
    by: Math.round((-(b.y - a.y) * shift.x + (b.x - a.x) * shift.y) / span),
  }
}

export function setWall(
  wall: Wall,
  fields: { thickness?: number; height?: number; base?: number },
): boolean {
  return runEdit(() =>
    documentStore.getState().apply(updateWall, { id: wall.element ?? wall.id, ...fields }),
  )
}

export function moveWallBy(wall: Wall, shift: Point, roomId?: string): boolean {
  if (roomId) {
    const { doc, level } = documentStore.getState()
    const args = wallMoveArgsOf(doc, level, wall, shift, roomId)
    return args ? runEdit(() => documentStore.getState().apply(updateRoom, args)) : false
  }
  const args = wallMoveArgs(wall, shift)
  if (args.by === 0) return true
  return runEdit(() => documentStore.getState().apply(updateWall, args))
}

export function previewWallMove(wall: Wall, shift: Point, roomId?: string): void {
  if (roomId) {
    const { doc, level } = documentStore.getState()
    const args = wallMoveArgsOf(doc, level, wall, shift, roomId)
    if (args) previewCommand(updateRoom, args)
    return
  }
  const args = wallMoveArgs(wall, shift)
  if (args.by === 0) {
    endPreview()
    return
  }
  previewCommand(updateWall, args)
}

export function knockThroughToBiggest(room: Room): boolean {
  if (!room.name) return false
  const { doc, level } = documentStore.getState()
  const rooms = roomsOf(doc, level)
  const neighbours = surveyRoom(doc, level, room)
    .neighbours.map((name) => rooms.find((candidate) => candidate.name === name))
    .filter((candidate) => candidate !== undefined && candidate.name !== undefined)
    .map((candidate) => candidate as Room & { name: string })
    .sort((one, other) => other.area - one.area)

  if (neighbours.length === 0) {
    sayError('there is nothing next door to knock this room through into')
    return false
  }

  let refused = ''
  for (const into of neighbours) {
    try {
      documentStore
        .getState()
        .apply(removeRoom, { room: roomRef(room) ?? room.name, into: roomRef(into) ?? into.name })
      return true
    } catch (error) {
      refused ||= error instanceof Error ? error.message : String(error)
    }
  }
  sayError(refused)
  return false
}

export function nameWall(wall: Wall, roomId?: string) {
  const { doc, level } = documentStore.getState()
  const named = wallNamedBy(doc, level, wall, roomId)
  return named
}

export function removeStub(wall: Wall): boolean {
  return runEdit(() => documentStore.getState().apply(removeWall, { id: wall.element ?? wall.id }))
}

function wallLengthArgs(wall: Wall, end: 'from' | 'to', length: number) {
  return { id: wall.element ?? wall.id, end, length: Math.max(10, Math.round(length / 10) * 10) }
}

export function resizeWall(wall: Wall, end: 'from' | 'to', length: number): boolean {
  return runEdit(() =>
    documentStore.getState().apply(updateWall, wallLengthArgs(wall, end, length)),
  )
}

export function previewWallResize(wall: Wall, end: 'from' | 'to', length: number): void {
  previewCommand(updateWall, wallLengthArgs(wall, end, length))
}
