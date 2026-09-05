import { roomOfOpening } from '@houseit/commands/openings'
import { removeOpening as removeOpeningCommand } from '@houseit/commands/remove'
import { updateOpening } from '@houseit/commands/update-opening'
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
 * would give: `update-opening`, `remove-opening`, with typed arguments through
 * the same store, refused by the same checks.
 */

/** Moves an opening to where it was let go, or says why it cannot go there. */
export function moveOpeningTo(opening: Opening, point: Point): void {
  const found = hung(opening)
  if (!found) return
  const drop = openingDropOf(found.doc, found.level, found.room, point)
  if (!drop) return
  runEdit(() =>
    documentStore
      .getState()
      .apply(updateOpening, { id: opening.id, toSide: drop.toSide, along: drop.along }),
  )
}

/** Changes a door's kind or width, or a window's width, height or sill, where it is. */
export function setOpening(
  opening: Opening,
  fields: { variant?: string; width?: number; height?: number; sill?: number },
): boolean {
  return runEdit(() =>
    documentStore.getState().apply(updateOpening, {
      id: opening.id,
      ...(fields.variant === undefined ? {} : { variant: fields.variant as 'hinged' }),
      ...(fields.width === undefined ? {} : { width: fields.width }),
      ...(fields.height === undefined ? {} : { height: fields.height }),
      ...(fields.sill === undefined ? {} : { sill: fields.sill }),
    }),
  )
}

/** Takes an opening out of its wall. */
export function removeOpening(opening: Opening): void {
  runEdit(() => documentStore.getState().apply(removeOpeningCommand, { id: opening.id }))
}

/** The room and side an opening belongs to, for the panel to name it by. */
export function whereOpening(opening: Opening) {
  const found = hung(opening)
  return found === undefined ? undefined : { room: found.room, side: found.side }
}

function hung(opening: Opening) {
  const { doc, level } = documentStore.getState()
  const room = roomOfOpening(doc, roomsOf(doc, level), opening)
  if (!room?.name) {
    sayError('this opening is in no named room, so nothing can be said about it')
    return undefined
  }
  const side = sideOfWall(doc, level, room, opening.wall)
  if (!side) return undefined
  return { doc, level, room: { ...room, name: room.name }, side }
}
