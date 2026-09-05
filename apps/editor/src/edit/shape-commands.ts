import { addRoom } from '@houseit/commands/add-room'
import type { Room } from '@houseit/geometry/rooms'
import { documentStore } from '../store/store'
import { runEdit } from './run-edit'

/**
 * What draws the shape of the plan: a wall dragged in from a side, a room cut
 * off another, the outline of the floor. Each is the command an agent would
 * give, with what the hand did worked out into the command's words.
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

export type FloorRequest = {
  kind: 'rectangle' | 'l' | 'u' | 't' | 'walk'
  width?: number
  depth?: number
  notchWidth?: number
  notchDepth?: number
  barDepth?: number
  stemWidth?: number
  walk?: string
  name: string
  material: string
}

/** Draws the outline of an empty floor: `add-room` with nothing to come out of. */
export function drawFloor(floor: FloorRequest): boolean {
  return runEdit(() =>
    documentStore.getState().apply(addRoom, {
      name: floor.name,
      material: floor.material,
      ...(floor.kind === 'walk'
        ? { walk: floor.walk ?? '' }
        : {
            shape: floor.kind,
            width: floor.width,
            depth: floor.depth,
            ...(floor.kind === 'l' || floor.kind === 'u'
              ? { notchWidth: floor.notchWidth, notchDepth: floor.notchDepth }
              : {}),
            ...(floor.kind === 't' ? { barDepth: floor.barDepth, stemWidth: floor.stemWidth } : {}),
          }),
    }),
  )
}
