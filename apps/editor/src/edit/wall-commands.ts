import { removeRoom } from '@houseit/commands/remove-room'
import { type Stub, stubsOn } from '@houseit/commands/stubs'
import { surveyRoom } from '@houseit/commands/survey'
import { removeWall, updateWall } from '@houseit/commands/wall'
import type { Wall } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { wallElement } from '@houseit/geometry/wall-elements'
import { documentStore } from '../store/store'
import { sayError } from './notice'
import { endPreview, previewCommand } from './preview'
import { roomRef } from './room-ref'
import { runEdit } from './run-edit'
import { wallNamedBy } from './wall-move'

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

export function moveWallBy(wall: Wall, shift: Point): boolean {
  const args = wallMoveArgs(wall, shift)
  if (args.by === 0) return true
  return runEdit(() => documentStore.getState().apply(updateWall, args))
}

export function previewWallMove(wall: Wall, shift: Point): void {
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

const SIDE_LIST = ['north', 'east', 'south', 'west'] as const

export function stubOf(
  wall: Wall,
): { room: Room & { name: string }; side: (typeof SIDE_LIST)[number]; stub: Stub } | undefined {
  const { doc, level } = documentStore.getState()
  for (const room of roomsOf(doc, level)) {
    if (!room.name || !room.nodes.includes(wall.a) || !room.nodes.includes(wall.b)) continue
    for (const side of SIDE_LIST) {
      const stub = stubsOn(doc, level, room, side).find(
        (candidate) => candidate.wall.id === wall.id,
      )
      if (stub) return { room: { ...room, name: room.name }, side, stub }
    }
  }
  return undefined
}

export function removeStub(wall: Wall): boolean {
  return runEdit(() => documentStore.getState().apply(removeWall, { id: wall.element ?? wall.id }))
}

function stubResizeArgs(wall: Wall, length: number) {
  const found = stubOf(wall)
  if (!found) return undefined
  const rounded = Math.max(10, Math.round(length / 10) * 10)
  if (rounded === found.stub.length) return undefined
  return {
    id: wall.element ?? wall.id,
    end:
      wallElement(documentStore.getState().doc, wall.id).from.id === found.stub.tip
        ? ('from' as const)
        : ('to' as const),
    length: rounded,
  }
}

export function resizeStub(wall: Wall, length: number): boolean {
  const args = stubResizeArgs(wall, length)
  if (!args) return stubOf(wall) !== undefined
  return runEdit(() => documentStore.getState().apply(updateWall, args))
}

export function previewStubResize(wall: Wall, length: number): void {
  const args = stubResizeArgs(wall, length)
  if (!args) {
    endPreview()
    return
  }
  previewCommand(updateWall, args)
}
