import type { HouseDocument, Level } from '@houseit/core/document'
import { levelAbove, levelBelow } from '@houseit/core/levels'
import { layerOf, objectType } from '@houseit/core/object-types'
import { roomsOf } from '@houseit/geometry/rooms'
import { piecesOf, standingAt } from '@houseit/geometry/standing'
import { stairwaysOn, type Well } from '@houseit/geometry/wells'
import { boxOf, clashes, clashesAny, wallBox } from '../boxes'
import { label, type Problem, type Rule } from './rule'

export const stairs: Rule = ({ doc, level }) => {
  const above = levelAbove(doc, level)
  const below = levelBelow(doc, level)
  return [
    ...stairwaysOn(doc, level).flatMap((well) => climbing(doc, well, above)),
    ...(below ? stairwaysOn(doc, below.id).flatMap((well) => blocked(doc, well, level)) : []),
  ]
}

function climbing(doc: HouseDocument, well: Well, above: Level | undefined): Problem[] {
  if (!above) {
    return [
      {
        code: 'stairs.nowhere',
        severity: 'warning',
        message: `the ${flightLabel(well)} has nowhere to climb to — there is no storey above this one`,
      },
    ]
  }
  return blocked(doc, well, above.id)
}

function blocked(doc: HouseDocument, well: Well, into: string): Problem[] {
  const problems: Problem[] = []
  const storey = doc.levels[into]
  const hole = boxOf(well.outline)

  const wall = Object.values(doc.walls).find((it) => {
    if (it.level !== into) return false
    const from = doc.nodes[it.a]
    const to = doc.nodes[it.b]
    return (
      from !== undefined && to !== undefined && clashes(hole, wallBox(from, to, it.thickness), 0)
    )
  })
  if (wall) {
    problems.push({
      code: 'stairs.well-blocked',
      severity: 'error',
      message: `the ${flightLabel(well)} comes up into a wall on ${storey?.name ?? into}`,
    })
  }

  const rooms = roomsOf(doc, into)
  const standing = Object.values(doc.objects).find((other) => {
    if (other.level !== into || layerOf(other.type) !== 'floor') return false
    const room = rooms.find((candidate) => candidate.id === other.room)
    const spot = room && standingAt(doc, into, room, other)
    return spot !== undefined && clashesAny([hole], piecesOf(spot, other).map(boxOf), 0)
  })
  if (standing) {
    problems.push({
      code: 'stairs.well-blocked',
      severity: 'error',
      room: rooms.find((candidate) => candidate.id === standing.room)?.name,
      message: `the ${label(standing)} on ${storey?.name ?? into} stands over the ${flightLabel(well)} coming up`,
    })
  }
  return problems
}

const flightLabel = (well: Well) => objectType(well.type)?.label.toLowerCase() ?? well.type
