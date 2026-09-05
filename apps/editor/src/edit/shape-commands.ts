import { addRoom } from '@houseit/commands/add-room'
import type { Room } from '@houseit/geometry/rooms'
import { documentStore } from '../store/store'
import { runEdit } from './run-edit'

/**
 * What draws the shape of the plan: a room cut off another. The command an
 * agent would give, with what the hand did worked out into its words.
 *
 * The outline of a bare storey is not here. It is the pencil — a walk of legs
 * that closes on itself — because a form asking for a width and a depth is a
 * worse way to draw a house than drawing one.
 */

export type CutRequest = {
  where:
    | 'north'
    | 'south'
    | 'east'
    | 'west'
    | 'north-west'
    | 'north-east'
    | 'south-west'
    | 'south-east'
  width: number
  depth?: number
  name: string
  material: string
}

/** Cuts a room off a side, or out of a corner, of a room. */
export function cutRoom(from: Room, cut: CutRequest): boolean {
  if (!from.name) return false
  const corner = cut.where.includes('-')
  return runEdit(() =>
    documentStore.getState().apply(addRoom, {
      name: cut.name,
      from: from.name!,
      ...(corner
        ? { corner: cut.where as 'north-west', depth: cut.depth }
        : { side: cut.where as 'north' }),
      width: cut.width,
      material: cut.material,
    }),
  )
}
