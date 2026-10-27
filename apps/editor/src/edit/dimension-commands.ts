import { applyCommand } from '@houseit/commands/run'
import { updateRoom } from '@houseit/commands/update-room'
import type { Dimension } from '@houseit/geometry/dimensions'
import { documentStore } from '../store/store'
import { sayError } from './notice'
import { runEdit } from './run-edit'

export function setDimension(dimension: Dimension, length: number): boolean {
  const { ends } = dimension
  if (!ends) return false
  const by = Math.round(length - dimension.length)
  if (by === 0) return true
  const { doc } = documentStore.getState()
  const fits = (wall: string) => {
    try {
      applyCommand(doc, updateRoom, { room: ends.room, wall, by })
      return true
    } catch {
      return false
    }
  }
  const wall = [ends.last, ends.first].find(fits)
  if (!wall) {
    sayError(`this side cannot become ${(length / 1000).toFixed(2)} m without breaking a room`)
    return false
  }
  return runEdit(() => documentStore.getState().apply(updateRoom, { room: ends.room, wall, by }))
}
