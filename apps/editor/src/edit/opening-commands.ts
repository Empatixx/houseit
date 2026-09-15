import { roomOfOpening } from '@houseit/commands/openings'
import { removeOpening as removeOpeningCommand } from '@houseit/commands/remove'
import { updateOpening } from '@houseit/commands/update-opening'
import type { Opening } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import { roomsOf } from '@houseit/geometry/rooms'
import { sideOfWall } from '@houseit/geometry/sides'
import { wallElement } from '@houseit/geometry/wall-elements'
import { openingDropOf } from '../scene/opening-drop'
import { documentStore } from '../store/store'
import { runEdit } from './run-edit'

export function moveOpeningTo(opening: Opening, point: Point): void {
  const { doc } = documentStore.getState()
  const wall = doc.walls[opening.wall]!
  const room = roomOfOpening(doc, roomsOf(doc, wall.level), opening)
  if (!room?.name) {
    const e = wallElement(doc, wall.id)
    const along = ((point.x - e.from.x) * e.unit.x + (point.y - e.from.y) * e.unit.y) / e.length
    runEdit(() =>
      documentStore.getState().apply(updateOpening, { id: opening.id, toWall: e.id, along }),
    )
    return
  }
  const found = hung(opening)
  if (!found) return
  const drop = openingDropOf(found.doc, found.level, found.room, point, opening.width)
  if (!drop) return
  runEdit(() =>
    documentStore
      .getState()
      .apply(updateOpening, { id: opening.id, toSide: drop.toSide, along: drop.along }),
  )
}

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

export function removeOpening(opening: Opening): void {
  runEdit(() => documentStore.getState().apply(removeOpeningCommand, { id: opening.id }))
}

export function whereOpening(opening: Opening) {
  const found = hung(opening)
  return found === undefined ? undefined : { room: found.room, side: found.side }
}

function hung(opening: Opening) {
  const { doc, level } = documentStore.getState()
  const room = roomOfOpening(doc, roomsOf(doc, level), opening)
  if (!room?.name) return undefined
  const side = sideOfWall(doc, level, room, opening.wall)
  if (!side) return undefined
  return { doc, level, room: { ...room, name: room.name }, side }
}
