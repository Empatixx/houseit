import { FRIDGE, KITCHEN_RUN } from '@houseit/core/furnishing'
import { roomKindOf } from '@houseit/core/room-kinds'
import { boxOf } from '@houseit/geometry/boxes'
import { piecesOf, standingAt } from '@houseit/geometry/standing'
import { objectsIn } from '../survey'
import type { Problem, Rule } from './rule'

const NEXT_TO_RUN = 1200

export const kitchens: Rule = ({ doc, level, rooms }) => {
  const problems: Problem[] = []
  for (const room of rooms) {
    const things = objectsIn(doc, level, room)
    const types = things.map((object) => object.type)
    const runs = things.filter((object) => KITCHEN_RUN.test(object.type))
    if (roomKindOf(room)?.id !== 'kitchen' && runs.length === 0) continue
    const missing = [
      ['a sink', types.some((type) => /^kitchen-(?!sink)|kitchen-sink|island-\d-sink/.test(type))],
      ['a stove', types.some((type) => /^kitchen-(?!sink)|stove/.test(type))],
      ['a fridge', types.some((type) => FRIDGE.test(type))],
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
    const boxesOf = (thing: (typeof things)[number]) => {
      const spot = standingAt(doc, level, room, thing)
      return spot ? piecesOf(spot, thing).map(boxOf) : []
    }
    const counter = runs.flatMap(boxesOf)
    for (const fridge of things.filter((object) => FRIDGE.test(object.type))) {
      if (counter.length === 0) break
      const gap = Math.min(
        ...boxesOf(fridge).flatMap((one) =>
          counter.map((other) =>
            Math.hypot(
              Math.max(0, other.x0 - one.x1, one.x0 - other.x1),
              Math.max(0, other.y0 - one.y1, one.y0 - other.y1),
            ),
          ),
        ),
      )
      if (gap > NEXT_TO_RUN)
        problems.push({
          code: 'kitchen.fridge-far',
          severity: 'warning',
          room: room.name,
          ids: [fridge.id],
          message: `the fridge in ${room.name} stands ${Math.round(gap)} mm from the kitchen run: put it at one end of the run, where food comes out to be worked on`,
        })
    }
  }
  return problems
}
