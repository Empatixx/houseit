import { levelBelow } from '@houseit/core/levels'
import { roomKindOf } from '@houseit/core/room-kinds'
import type { OpeningReport, RoomReport } from '../survey'
import { doorsOf, type Problem, type Rule } from './rule'

type LeadsOut = (door: OpeningReport) => boolean

export const reach: Rule = ({ reports, level, doc }) => {
  const problems: Problem[] = []
  if (reports.length === 0) return problems

  const outdoors = new Set(
    reports.filter((room) => roomKindOf(room)?.outdoor).map((room) => room.name),
  )
  const named = reports.filter((room) => room.name !== undefined && !outdoors.has(room.name))
  const leadsOut: LeadsOut = (door) => door.to === 'outside' || outdoors.has(door.to)
  const entrances = entrancesTo(named, leadsOut)
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
    const reached = walkFrom(entrances, named, leadsOut)
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

function entrancesTo(named: RoomReport[], leadsOut: LeadsOut): RoomReport[] {
  const outside = named.filter((room) => doorsOf(room).some(leadsOut))
  const landings = named.filter(
    (room) => (room.wells?.length ?? 0) > 0 && !doorsOf(room).some(leadsOut),
  )
  return [...outside, ...landings]
}

function walkFrom(entrances: RoomReport[], named: RoomReport[], leadsOut: LeadsOut): Set<string> {
  const reached = new Set<string>()
  const queue = entrances.map((room) => room.name!)
  while (queue.length > 0) {
    const name = queue.shift()!
    if (reached.has(name)) continue
    reached.add(name)
    const room = named.find((candidate) => candidate.name === name)
    for (const door of room ? doorsOf(room) : []) {
      if (door.to !== undefined && !leadsOut(door) && !reached.has(door.to)) {
        queue.push(door.to)
      }
    }
  }
  return reached
}
