import { addRoom } from '@houseit/commands/add-room'
import type { Room } from '@houseit/geometry/rooms'
import { documentStore } from '../store/store'
import { runEdit } from './run-edit'

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
