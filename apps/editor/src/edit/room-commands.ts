import { updateRoom } from '@houseit/commands/update-room'
import type { Part } from '@houseit/core/finishes'
import type { Room } from '@houseit/geometry/rooms'
import { documentStore } from '../store/store'
import { runEdit } from './run-edit'

export function setKind(room: Room, kind: string): boolean {
  if (!room.name) return false
  return runEdit(() => documentStore.getState().apply(updateRoom, { room: room.name!, kind }))
}

export function layFloor(room: Room, material: string): boolean {
  if (!room.name) return false
  return runEdit(() => documentStore.getState().apply(updateRoom, { room: room.name!, material }))
}

export function setStyle(room: Room, style: string): boolean {
  if (!room.name) return false
  return runEdit(() => documentStore.getState().apply(updateRoom, { room: room.name!, style }))
}

export function setFinish(room: Room, part: Part, finish: string): boolean {
  if (!room.name) return false
  const worn: Partial<Record<Part, string>> = { [part]: finish }
  return runEdit(() => documentStore.getState().apply(updateRoom, { room: room.name!, ...worn }))
}
