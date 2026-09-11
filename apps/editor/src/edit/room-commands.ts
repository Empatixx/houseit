import { updateRoom } from '@houseit/commands/update-room'
import type { Part } from '@houseit/core/finishes'
import type { Room } from '@houseit/geometry/rooms'
import { documentStore } from '../store/store'
import { roomRef } from './room-ref'
import { runEdit } from './run-edit'

export function setKind(room: Room, kind: string): boolean {
  const ref = roomRef(room)
  if (ref === undefined) return false
  return runEdit(() => documentStore.getState().apply(updateRoom, { room: ref, kind }))
}

export function layFloor(room: Room, material: string): boolean {
  const ref = roomRef(room)
  if (ref === undefined) return false
  return runEdit(() => documentStore.getState().apply(updateRoom, { room: ref, material }))
}

export function setStyle(room: Room, style: string): boolean {
  const ref = roomRef(room)
  if (ref === undefined) return false
  return runEdit(() => documentStore.getState().apply(updateRoom, { room: ref, style }))
}

export function setFinish(room: Room, part: Part, finish: string): boolean {
  const ref = roomRef(room)
  if (ref === undefined) return false
  const worn: Partial<Record<Part, string>> = { [part]: finish }
  return runEdit(() => documentStore.getState().apply(updateRoom, { room: ref, ...worn }))
}
