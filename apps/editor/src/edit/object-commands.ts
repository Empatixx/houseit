import { removeObject } from '@houseit/commands/remove'
import { updateObject } from '@houseit/commands/update-object'
import type { HouseObject } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import { roomsOf } from '@houseit/geometry/rooms'
import { dropOf } from '../scene/furniture/drop'
import { documentStore } from '../store/store'
import { sayError } from './notice'
import { runEdit } from './run-edit'

/**
 * What a drag or a key does to a thing, as the command an agent would give.
 *
 * Nothing here touches the document, and nothing here writes a line of text:
 * the command is called with typed arguments through the same store the
 * command bar and the bridge use, and refused by the same checks — so a sofa
 * cannot be dragged into a wall, and every move undoes. The words are the
 * agent's way in; this is the editor's, and the logic under both is one.
 *
 * A thing is named by its id, because that is what the agent names it by too.
 * There used to be a second way — the room, the type, and which of that type —
 * and having two ways of saying which sofa meant one of them was always the one
 * that got it wrong.
 */

/** Moves a thing to where it was let go, or says why it cannot go there. */
export function moveTo(object: HouseObject, centre: Point): void {
  const found = placed(object)
  if (!found) return
  const drop = dropOf(found.doc, found.level, found.room, object, centre)
  runEdit(() => documentStore.getState().apply(updateObject, { id: object.id, ...drop }))
}

/** Turns a thing on the spot by so many degrees, or says why it cannot turn. */
export function turnBy(object: HouseObject, degrees: number): void {
  turnTo(object, whole((object.rotation ?? 0) + degrees))
}

/** Turns a thing to a turn, in degrees on top of the way it faces. */
export function turnTo(object: HouseObject, degrees: number): boolean {
  return runEdit(() =>
    documentStore.getState().apply(updateObject, { id: object.id, rotation: whole(degrees) }),
  )
}

/** A turn as one number in (-360, 360), with a full circle taken out. */
const whole = (degrees: number) => Math.round(degrees) % 360

/** Gives a thing another finish. */
export function finish(object: HouseObject, surface: string): boolean {
  return runEdit(() => documentStore.getState().apply(updateObject, { id: object.id, surface }))
}

/** Makes a thing another size where it stands. */
export function resize(object: HouseObject, size: { width?: number; depth?: number }): boolean {
  return runEdit(() => documentStore.getState().apply(updateObject, { id: object.id, ...size }))
}

/** Takes a thing out of the plan. */
export function remove(object: HouseObject): void {
  runEdit(() => documentStore.getState().apply(removeObject, { id: object.id }))
}

/** The room a thing stands in, for the panel to name it by. */
export function roomOf(object: HouseObject) {
  return placed(object)?.room
}

/**
 * Where a thing stands: its document, its storey and its room. The storey is
 * the thing's own, not the one the tab has open — a staircase is picked from
 * the floor above, through the well it comes up in, and it still stands on the
 * floor below.
 */
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
