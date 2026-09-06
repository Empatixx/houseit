import { roomKindOf } from '@houseit/core/room-kinds'
import { objectsIn } from '../survey'
import type { Problem, Rule } from './rule'

/** A kitchen has somewhere to wash, cook and keep food. */
export const kitchens: Rule = ({ doc, level, rooms }) => {
  const problems: Problem[] = []
  for (const room of rooms) {
    if (roomKindOf(room)?.id !== 'kitchen') continue
    const types = objectsIn(doc, level, room).map((object) => object.type)
    const missing = [
      ['a sink', types.some((type) => /^kitchen-(?!sink)|kitchen-sink|island-\d-sink/.test(type))],
      ['a stove', types.some((type) => /^kitchen-(?!sink)|stove/.test(type))],
      ['a fridge', types.some((type) => /refrigerator/.test(type))],
    ]
      .filter(([, has]) => !has)
      .map(([what]) => what)
    if (missing.length > 0) {
      problems.push({
        code: 'kitchen.incomplete',
        severity: 'warning',
        room: room.name,
        message: `${room.name} has no ${missing.join(', no ')}`,
      })
    }
  }
  return problems
}
