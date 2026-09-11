import { addObject } from '@houseit/commands/add-object'
import { removeObject } from '@houseit/commands/remove'
import { updateObject } from '@houseit/commands/update-object'
import type { HouseObject } from '@houseit/core/document'
import { CAMERA } from '@houseit/core/object-types'
import type { Point } from '@houseit/geometry/outlines'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { dropOf } from '../scene/furniture/drop'
import { documentStore } from '../store/store'
import { sayError } from './notice'
import { endPreview, previewCommand } from './preview'
import { roomRef } from './room-ref'
import { runEdit } from './run-edit'

export function moveTo(object: HouseObject, centre: Point): void {
  const found = placed(object)
  if (!found) return
  const drop = dropOf(found.doc, found.level, found.room, object, centre)
  runEdit(() => documentStore.getState().apply(updateObject, { id: object.id, ...drop }))
}

export function turnBy(object: HouseObject, degrees: number): void {
  turnTo(object, whole((object.rotation ?? 0) + degrees))
}

export function turningTo(object: HouseObject, degrees: number): void {
  previewCommand(updateObject, { id: object.id, rotation: whole(degrees) })
}

export const stopTurning = endPreview

export function turnTo(object: HouseObject, degrees: number): boolean {
  return runEdit(() =>
    documentStore.getState().apply(updateObject, { id: object.id, rotation: whole(degrees) }),
  )
}

const whole = (degrees: number) => ((Math.round(degrees) % 360) + 360) % 360

export function finish(object: HouseObject, surface: string): boolean {
  return runEdit(() => documentStore.getState().apply(updateObject, { id: object.id, surface }))
}

export function resize(object: HouseObject, size: { width?: number; depth?: number }): boolean {
  return runEdit(() => documentStore.getState().apply(updateObject, { id: object.id, ...size }))
}

export function remove(object: HouseObject): void {
  runEdit(() => documentStore.getState().apply(removeObject, { id: object.id }))
}

export function roomOf(object: HouseObject) {
  return placed(object)?.room
}

function placed(object: HouseObject) {
  const { doc } = documentStore.getState()
  const level = object.level
  const room = roomsOf(doc, level).find((candidate) => candidate.id === object.room)
  if (!room?.name) {
    sayError('the room this stands in has no name, so nothing can be said about it')
    return undefined
  }
  return { doc, level, room: { ...room, name: room.name } }
}

const CAMERA_SPOTS: [number, number][] = [
  [0.5, 0.5],
  [0.3, 0.3],
  [0.7, 0.3],
  [0.3, 0.7],
  [0.7, 0.7],
  [0.5, 0.15],
  [0.15, 0.5],
]

export function placeCamera(room: Room): string | undefined {
  const name = roomRef(room)
  if (name === undefined) return undefined
  let refused = ''
  for (const [along, across] of CAMERA_SPOTS) {
    const before = new Set(Object.keys(documentStore.getState().doc.objects))
    try {
      documentStore.getState().apply(addObject, { room: name, type: CAMERA, along, across })
    } catch (error) {
      refused ||= error instanceof Error ? error.message : String(error)
      continue
    }
    const id = Object.keys(documentStore.getState().doc.objects).find((key) => !before.has(key))
    if (id) return id
  }
  sayError(refused || 'there is no floor free for a camera')
  return undefined
}
