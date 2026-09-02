import { moveObject } from '@houseit/commands/move-object'
import { removeObject } from '@houseit/commands/remove'
import { resizeObject } from '@houseit/commands/resize-object'
import { setSurface } from '@houseit/commands/set-surface'
import { objectsIn } from '@houseit/commands/survey'
import { turnObject } from '@houseit/commands/turn-object'
import type { HouseObject } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import { roomsOf } from '@houseit/geometry/rooms'
import { dropOf } from '../scene/furniture/drop'
import { noticeStore } from '../store/notice'
import { documentStore } from '../store/store'
import { runEdit } from './run-edit'

/**
 * What a drag or a key does to a thing, as the command an agent would give.
 *
 * Nothing here touches the document, and nothing here writes a line of text:
 * the command is called with typed arguments through the same store the
 * command bar and the bridge use, and refused by the same checks — so a sofa
 * cannot be dragged into a wall, and every move undoes. The words are the
 * agent's way in; this is the editor's, and the logic under both is one.
 */

/** Moves a thing to where it was let go, or says why it cannot go there. */
export function moveTo(object: HouseObject, centre: Point): void {
  const named = name(object)
  if (!named) return
  const { doc, level, room } = named
  const drop = dropOf(doc, level, room, object, centre)
  run(() =>
    documentStore
      .getState()
      .apply(moveObject, { room: room.name, type: object.type, nth: named.nth, ...drop }),
  )
}

/** Turns a thing on the spot by so many degrees, or says why it cannot turn. */
export function turnBy(object: HouseObject, degrees: number): void {
  const named = name(object)
  if (!named) return
  run(() =>
    documentStore
      .getState()
      .apply(turnObject, { room: named.room.name, type: object.type, nth: named.nth, by: degrees }),
  )
}

/** Turns a thing to a turn, in degrees on top of the way it faces. */
export function turnTo(object: HouseObject, degrees: number): boolean {
  const named = name(object)
  if (!named) return false
  return runEdit(() =>
    documentStore
      .getState()
      .apply(turnObject, { room: named.room.name, type: object.type, nth: named.nth, to: degrees }),
  )
}

/** Gives a thing another finish. */
export function finish(object: HouseObject, surface: string): boolean {
  const named = name(object)
  if (!named) return false
  return runEdit(() =>
    documentStore
      .getState()
      .apply(setSurface, { room: named.room.name, type: object.type, nth: named.nth, surface }),
  )
}

/** Makes a thing another size where it stands. */
export function resize(object: HouseObject, size: { width?: number; depth?: number }): boolean {
  const named = name(object)
  if (!named) return false
  return runEdit(() =>
    documentStore
      .getState()
      .apply(resizeObject, { room: named.room.name, type: object.type, nth: named.nth, ...size }),
  )
}

/** Takes a thing out of the plan. */
export function remove(object: HouseObject): void {
  const named = name(object)
  if (!named) return
  run(() =>
    documentStore
      .getState()
      .apply(removeObject, { room: named.room.name, type: object.type, nth: named.nth }),
  )
}

/**
 * A thing the way a command names it: by its room, its type and which of that
 * type it is — the first nightstand, the second — since nothing takes an id.
 */
export function nameObject(object: HouseObject) {
  return name(object)
}

function name(object: HouseObject) {
  const { doc, level } = documentStore.getState()
  const room = roomsOf(doc, level).find((candidate) => candidate.id === object.room)
  if (!room?.name) {
    noticeStore
      .getState()
      .say('the room this stands in has no name, so nothing can be said about it')
    return undefined
  }
  const nth =
    objectsIn(doc, level, room)
      .filter((other) => other.type === object.type)
      .findIndex((other) => other.id === object.id) + 1
  return { doc, level, room: { ...room, name: room.name }, nth }
}

function run(change: () => unknown): void {
  runEdit(change)
}
