import { commandLine } from '@houseit/commands/command-line'
import { objectsIn } from '@houseit/commands/survey'
import type { HouseObject } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import { roomsOf } from '@houseit/geometry/rooms'
import { dropOf } from '../scene/furniture/drop'
import { noticeStore } from '../store/notice'
import { documentStore } from '../store/store'

/**
 * What a drag or a key does to a thing, said as the command an agent would
 * say. Nothing here touches the document: the line is built, run through the
 * same store the command bar and the bridge use, and refused by the same
 * checks — so a sofa cannot be dragged into a wall, and every move undoes.
 */

/** Moves a thing to where it was let go, or says why it cannot go there. */
export function moveTo(object: HouseObject, centre: Point): void {
  const named = name(object)
  if (!named) return
  const { doc, level, room } = named
  const drop = dropOf(doc, level, room, object, centre)
  run(commandLine('move-object', { room: room.name, type: object.type, nth: named.nth, ...drop }))
}

/** Turns a thing on the spot by so many degrees, or says why it cannot turn. */
export function turnBy(object: HouseObject, degrees: number): void {
  const named = name(object)
  if (!named) return
  run(
    commandLine('turn-object', {
      room: named.room.name,
      type: object.type,
      nth: named.nth,
      by: degrees,
    }),
  )
}

/** Takes a thing out of the plan. */
export function remove(object: HouseObject): void {
  const named = name(object)
  if (!named) return
  run(commandLine('remove-object', { room: named.room.name, type: object.type, nth: named.nth }))
}

/**
 * A thing the way a command names it: by its room, its type and which of that
 * type it is — the first nightstand, the second — since nothing takes an id.
 */
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

function run(line: string): void {
  try {
    documentStore.getState().exec(line)
    noticeStore.getState().clear()
  } catch (error) {
    noticeStore.getState().say(error instanceof Error ? error.message : String(error))
  }
}
