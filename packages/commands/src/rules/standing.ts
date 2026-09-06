import { standingProblem } from '../standing-check'
import { objectsIn } from '../survey'
import { label, type Problem, type Rule } from './rule'

export const standing: Rule = ({ doc, level, rooms }) => {
  const problems: Problem[] = []
  for (const room of rooms) {
    if (!room.id) continue
    for (const object of objectsIn(doc, level, room)) {
      const spot = {
        ...(object.against ? { against: object.against } : {}),
        ...(object.againstNth !== undefined ? { againstNth: object.againstNth } : {}),
        along: object.along,
        ...(object.across !== undefined ? { across: object.across } : {}),
      }
      const problem = standingProblem(doc, level, room, spot, object, object.id)
      if (problem) {
        problems.push({
          code: 'object.misplaced',
          severity: 'error',
          room: room.name,
          message: `the ${label(object)} in ${room.name ?? 'an unnamed room'}: ${problem}`,
        })
      }
    }
  }
  return problems
}
