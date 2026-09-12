import { levelBelow } from '@houseit/core/levels'
import type { RoomReport } from '../survey'
import { doorsOf, type Problem, type Rule } from './rule'

export const reach: Rule = ({ reports, level, doc }) => {
  const problems: Problem[] = []
  if (reports.length === 0) return problems

  const named = reports.filter((room) => room.name !== undefined)
  const entrances = entrancesTo(reports)
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

  if (entrances.length > 0 && named.length === reports.length) {
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

function entrancesTo(named: RoomReport[]): RoomReport[] {
  const outside = named.filter((room) => doorsOf(room).some((door) => door.to === 'outside'))
  const landings = named.filter(
    (room) => (room.wells?.length ?? 0) > 0 && !doorsOf(room).some((door) => door.to === 'outside'),
  )
  return [...outside, ...landings]
}

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
