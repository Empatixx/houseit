import { addDoor } from '@houseit/commands/add-door'
import { addObject } from '@houseit/commands/add-object'
import { addWindow } from '@houseit/commands/add-window'
import { objectType } from '@houseit/core/object-types'
import type { Point } from '@houseit/geometry/outlines'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { dropOf } from '../scene/furniture/drop'
import { openingDropOf } from '../scene/opening-drop'
import { documentStore } from '../store/store'
import type { Armed } from '../store/tool'
import { runEdit } from './run-edit'

/**
 * Puts what the palette armed where the plan was clicked, as the command an
 * agent would give: `add-object` against the nearest wall or out in the room,
 * `add-door` or `add-window` in the nearest wall, each with the exact
 * `--along` the click meant. The plan checks it as it checks everything.
 */
export function placeArmed(armed: Armed, room: Room, point: Point): boolean {
  if (!room.name) return false
  const { doc, level } = documentStore.getState()
  const name = room.name

  if (armed.kind === 'object') {
    const type = objectType(armed.type)
    if (!type) return false
    const drop = dropOf(doc, level, room, type.size, point)
    return runEdit(() =>
      documentStore.getState().apply(addObject, { room: name, type: type.id, ...drop }),
    )
  }

  const drop = openingDropOf(doc, level, room, point)
  if (!drop) return false
  if (armed.kind === 'door') {
    return runEdit(() =>
      documentStore.getState().apply(addDoor, {
        room: name,
        side: drop.toSide,
        along: drop.along,
        variant: armed.variant,
      }),
    )
  }
  return runEdit(() =>
    documentStore.getState().apply(addWindow, { room: name, side: drop.toSide, along: drop.along }),
  )
}

/** The same, for a click that landed on something standing in the room rather than its floor. */
export function placeArmedIn(armed: Armed, roomId: string, point: Point): boolean {
  const { doc, level } = documentStore.getState()
  const room = roomsOf(doc, level).find((candidate) => candidate.id === roomId)
  return room ? placeArmed(armed, room, point) : false
}
