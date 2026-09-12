import { addObject } from '@houseit/commands/add-object'
import { addOpening, openingWidth } from '@houseit/commands/add-opening'
import { objectType } from '@houseit/core/object-types'
import type { Point } from '@houseit/geometry/outlines'
import type { Room } from '@houseit/geometry/rooms'
import { dropOf } from '../scene/furniture/drop'
import { openingDropOf } from '../scene/opening-drop'
import { documentStore } from '../store/store'
import type { Armed } from '../store/tool'
import { roomRef } from './room-ref'
import { runEdit } from './run-edit'

export function placeArmed(armed: Armed, room: Room, point: Point): boolean {
  const name = roomRef(room)
  if (name === undefined) return false
  const { doc, level } = documentStore.getState()

  if (armed.kind === 'object') {
    const type = objectType(armed.type)
    if (!type) return false
    const drop = dropOf(doc, level, room, type.size, point)
    return runEdit(() =>
      documentStore.getState().apply(addObject, { room: name, type: type.id, ...drop }),
    )
  }

  const drop = openingDropOf(
    doc,
    level,
    room,
    point,
    armed.kind === 'door' ? openingWidth('door', armed.variant) : openingWidth('window'),
  )
  if (!drop) return false
  if (armed.kind === 'door') {
    return runEdit(() =>
      documentStore.getState().apply(addOpening, {
        room: name,
        kind: 'door',
        side: drop.toSide,
        along: drop.along,
        variant: armed.variant,
      }),
    )
  }
  return runEdit(() =>
    documentStore
      .getState()
      .apply(addOpening, { room: name, kind: 'window', side: drop.toSide, along: drop.along }),
  )
}
