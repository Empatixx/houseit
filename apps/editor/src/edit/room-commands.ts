import { renameRoom } from '@houseit/commands/rename-room'
import { setFloor } from '@houseit/commands/set-floor'
import { setRoomKind } from '@houseit/commands/set-room-kind'
import type { Room } from '@houseit/geometry/rooms'
import { documentStore } from '../store/store'
import { runEdit } from './run-edit'

/** What the panel does to a room, as the commands an agent would give. */

export function rename(room: Room, name: string): boolean {
  if (!room.name || name.trim() === room.name) return true
  return runEdit(() => documentStore.getState().apply(renameRoom, { room: room.name!, name }))
}

export function setKind(room: Room, kind: string): boolean {
  if (!room.name) return false
  return runEdit(() => documentStore.getState().apply(setRoomKind, { room: room.name!, kind }))
}

export function layFloor(room: Room, material: string): boolean {
  if (!room.name) return false
  return runEdit(() => documentStore.getState().apply(setFloor, { room: room.name!, material }))
}
