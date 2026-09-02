import { moveDoor, moveWindow } from '@houseit/commands/move-opening'
import { openingsOn, roomOfOpening } from '@houseit/commands/openings'
import { removeDoor, removeWindow } from '@houseit/commands/remove'
import { setDoor, setWindow } from '@houseit/commands/set-opening'
import type { Opening } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import { roomsOf } from '@houseit/geometry/rooms'
import { sideOfWall } from '@houseit/geometry/sides'
import { openingDropOf } from '../scene/opening-drop'
import { documentStore } from '../store/store'
import { sayError } from './notice'
import { runEdit } from './run-edit'

/**
 * What a drag or a key does to a door or a window, as the command an agent
 * would give: `move-door`, `remove-window`, with typed arguments through the
 * same store, refused by the same checks.
 */

/** Moves an opening to where it was let go, or says why it cannot go there. */
export function moveOpeningTo(opening: Opening, point: Point): void {
  const named = name(opening)
  if (!named) return
  const drop = openingDropOf(named.doc, named.level, named.room, point)
  if (!drop) return
  const command = opening.kind === 'door' ? moveDoor : moveWindow
  run(() =>
    documentStore.getState().apply(command, {
      room: named.room.name,
      side: named.side,
      nth: named.nth,
      toSide: drop.toSide,
      along: drop.along,
    }),
  )
}

/** Changes a door's kind or width, or a window's width, height or sill, where it is. */
export function setOpening(
  opening: Opening,
  fields: { variant?: string; width?: number; height?: number; sill?: number },
): boolean {
  const named = name(opening)
  if (!named) return false
  const where = { room: named.room.name, side: named.side, nth: named.nth }
  return runEdit(() =>
    opening.kind === 'door'
      ? documentStore.getState().apply(setDoor, {
          ...where,
          ...(fields.variant === undefined ? {} : { variant: fields.variant as 'hinged' }),
          ...(fields.width === undefined ? {} : { width: fields.width }),
        })
      : documentStore.getState().apply(setWindow, {
          ...where,
          ...(fields.width === undefined ? {} : { width: fields.width }),
          ...(fields.height === undefined ? {} : { height: fields.height }),
          ...(fields.sill === undefined ? {} : { sill: fields.sill }),
        }),
  )
}

/** Takes an opening out of its wall. */
export function removeOpening(opening: Opening): void {
  const named = name(opening)
  if (!named) return
  const command = opening.kind === 'door' ? removeDoor : removeWindow
  run(() =>
    documentStore
      .getState()
      .apply(command, { room: named.room.name, side: named.side, nth: named.nth }),
  )
}

/**
 * An opening the way a command names it: the room it belongs to, the side of
 * that room its wall is on, and which of the openings there it is.
 */
export function nameOpening(opening: Opening) {
  return name(opening)
}

function name(opening: Opening) {
  const { doc, level } = documentStore.getState()
  const room = roomOfOpening(doc, roomsOf(doc, level), opening)
  if (!room?.name) {
    sayError('this opening is in no named room, so nothing can be said about it')
    return undefined
  }
  const side = sideOfWall(doc, level, room, opening.wall)
  if (!side) return undefined
  let nth: number
  try {
    nth =
      openingsOn(doc, level, room, side, opening.kind).findIndex((it) => it.id === opening.id) + 1
  } catch (error) {
    sayError(error instanceof Error ? error.message : String(error))
    return undefined
  }
  if (nth === 0) {
    sayError(`this ${opening.kind} is not in a wall on the ${side} side of ${room.name}`)
    return undefined
  }
  return { doc, level, room: { ...room, name: room.name }, side, nth }
}

function run(change: () => unknown): void {
  runEdit(change)
}
