import { levelBelow } from '@houseit/core/levels'
import type { RoomReport } from '../survey'
import { doorsOf, type Problem, type Rule } from './rule'

/**
 * Every room has a door, and every room can be walked to from the way in.
 *
 * The way in is the front door on the storey that has one, and the top of the
 * stairs on every storey above: an upper floor with no door to the outside is
 * an upper floor, not a house nobody can get into. So a room the stairs come up
 * into counts as an entrance to its storey, and only a storey with neither is
 * one nobody can reach.
 */
export const reach: Rule = ({ reports, level, doc }) => {
  const problems: Problem[] = []
  if (reports.length === 0) return problems

  const named = reports.filter((room) => room.name !== undefined)
  const entrances = entrancesTo(named)
  if (entrances.length === 0) {
    problems.push({
      code: 'house.no-entrance',
      severity: 'error',
      message: levelBelow(doc, level)
        ? `nothing reaches ${doc.levels[level]?.name ?? 'this storey'} — no door outside and no stairs coming up`
        : 'no door leads outside — nobody can get in',
    })
  }

  for (const room of named) {
    if (doorsOf(room).length === 0) {
      problems.push({
        code: 'room.no-door',
        severity: 'error',
        room: room.name,
        message: `${room.name} has no door`,
      })
    }
  }

  if (entrances.length > 0) {
    const reached = walkFrom(entrances, named)
    for (const room of named) {
      if (!reached.has(room.name!) && doorsOf(room).length > 0) {
        problems.push({
          code: 'room.unreachable',
          severity: 'error',
          room: room.name,
          message: `${room.name} cannot be reached from the front door`,
        })
      }
    }
  }
  return problems
}

/** A door to the outside, or the stairs arriving where there is no such door. */
function entrancesTo(named: RoomReport[]): RoomReport[] {
  const outside = named.filter((room) => doorsOf(room).some((door) => door.to === 'outside'))
  const landings = named.filter(
    (room) => (room.wells?.length ?? 0) > 0 && !doorsOf(room).some((door) => door.to === 'outside'),
  )
  return [...outside, ...landings]
}

/** The house walked from its entrances, door by door. */
function walkFrom(entrances: RoomReport[], named: RoomReport[]): Set<string> {
  const reached = new Set<string>()
  const queue = entrances.map((room) => room.name!)
  while (queue.length > 0) {
    const name = queue.shift()!
    if (reached.has(name)) continue
    reached.add(name)
    const room = named.find((candidate) => candidate.name === name)
    for (const door of room ? doorsOf(room) : []) {
      if (door.to !== undefined && door.to !== 'outside' && !reached.has(door.to)) {
        queue.push(door.to)
      }
    }
  }
  return reached
}
