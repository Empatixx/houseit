import { removeRoom } from '@houseit/commands/remove-room'
import { surveyRoom } from '@houseit/commands/survey'
import { updateRoom } from '@houseit/commands/update-room'
import { removeWall, updateWall } from '@houseit/commands/wall'
import type { Wall } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { wallElement } from '@houseit/geometry/wall-elements'
import { previewStore } from '../store/preview'
import { documentStore } from '../store/store'
import { constrainWallEdit } from './constrained-wall-edit'
import { sayError } from './notice'
import { roomRef } from './room-ref'
import { runEdit } from './run-edit'
import { wallAlignmentShifts, wallMoveArgsOf, wallNamedBy } from './wall-move'

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
  return runEdit(() => {
    const edit = constrainedMove(wall, shift, roomId)
    edit?.commit()
  })
}

function constrainedMove(wall: Wall, shift: Point, roomId?: string, preview = false) {
  const { doc, level, apply } = documentStore.getState()
  const alignments = wallAlignmentShifts(doc, wall)
  if (roomId) {
    const args = wallMoveArgsOf(doc, level, wall, shift, roomId)
    if (!args) return undefined
    const stops = alignments.flatMap((shift) => {
      const args = wallMoveArgsOf(doc, level, wall, shift, roomId)
      return args ? [args.by] : []
    })
    const edit = constrainWallEdit(
      doc,
      updateRoom,
      (by) => ({ ...args, by }),
      0,
      args.by,
      stops,
      preview,
    )
    return { doc: edit.doc, commit: () => edit.changed && apply(updateRoom, edit.args) }
  }
  const args = wallMoveArgs(wall, shift)
  const stops = alignments.map((shift) => wallMoveArgs(wall, shift).by)
  const edit = constrainWallEdit(
    doc,
    updateWall,
    (by) => ({ ...args, by }),
    0,
    args.by,
    stops,
    preview,
  )
  return { doc: edit.doc, commit: () => edit.changed && apply(updateWall, edit.args) }
}

export function previewWallMove(wall: Wall, shift: Point, roomId?: string): void {
  try {
    const edit = constrainedMove(wall, shift, roomId, true)
    if (edit) previewStore.getState().show(edit.doc)
  } catch (error) {
    previewStore.getState().refuse(error instanceof Error ? error.message : String(error))
  }
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

function constrainedResize(wall: Wall, end: 'from' | 'to', length: number, preview = false) {
  const { doc } = documentStore.getState()
  const element = wallElement(doc, wall.id)
  return constrainWallEdit(
    doc,
    updateWall,
    (length) => ({ id: element.id, end, length }),
    element.length,
    Math.max(10, Math.round(length)),
    [],
    preview,
  )
}

export function resizeWall(wall: Wall, end: 'from' | 'to', length: number): boolean {
  return runEdit(() => {
    const edit = constrainedResize(wall, end, length)
    if (edit.changed) documentStore.getState().apply(updateWall, edit.args)
  })
}

export function previewWallResize(wall: Wall, end: 'from' | 'to', length: number): void {
  try {
    previewStore.getState().show(constrainedResize(wall, end, length, true).doc)
  } catch (error) {
    previewStore.getState().refuse(error instanceof Error ? error.message : String(error))
  }
}
