import type { HouseDocument, HouseObject } from '@houseit/core/document'
import { layerOf, objectType } from '@houseit/core/object-types'
import { kindOf } from '@houseit/core/room-kinds'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { footprintOf, standingAt } from '@houseit/geometry/standing'
import { z } from 'zod'
import { type Box, boxOf, clashes } from './boxes'
import { defineCommand } from './define-command'
import { swingOf } from './place-opening'
import { levelOf } from './resolve'
import { standingProblem } from './standing-check'
import { objectsIn, type RoomReport, surveyLevel } from './survey'

/**
 * Reads the plan for trouble: a room nobody can get to, a bedroom opening
 * straight into the kitchen, a door that cannot swing for the sofa in front
 * of it, a laundry too small to be one, a living room with no window. Changes
 * nothing and answers with the list — empty is what a finished plan gets.
 *
 * The rules are the ones the reference reviews a plan by and the ones this plan's own
 * commands already keep, so nothing is refused here that a command would have
 * allowed without a word. What sort of room a room is comes from its name, for
 * now: see `room-kinds`.
 */

export type Problem = {
  /** What kind of trouble, as a stable word for scripts: `room.unreachable`. */
  code: string
  /** An error makes the plan wrong; a warning makes it worse. */
  severity: 'error' | 'warning'
  room?: string
  message: string
}

export const checkPlan = defineCommand({
  name: 'check-plan',
  summary: 'Read the plan for trouble: reach, privacy, doors, sizes, windows, things in the way',
  args: z.object({
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'check-plan')
    const problems = checkLevel(draft, level)
    return {
      level,
      ok: problems.every((problem) => problem.severity !== 'error'),
      problems,
    }
  },
})

export function checkLevel(doc: HouseDocument, level: string): Problem[] {
  const survey = surveyLevel(doc, level)
  const rooms = roomsOf(doc, level)
  const problems: Problem[] = [
    ...reach(survey.rooms),
    ...privacy(survey.rooms),
    ...sizes(survey.rooms),
    ...windows(survey.rooms),
    ...kitchens(doc, level, rooms),
    ...doors(doc, level, rooms),
    ...standing(doc, level, rooms),
  ]
  return problems.sort((one, other) => rank(one) - rank(other))
}

const rank = (problem: Problem) => (problem.severity === 'error' ? 0 : 1)

/** Every room has a door, and every room can be walked to from the front door. */
function reach(rooms: RoomReport[]): Problem[] {
  const problems: Problem[] = []
  if (rooms.length === 0) return problems

  const named = rooms.filter((room) => room.name !== undefined)
  const entrances = named.filter((room) => room.doors.some((door) => door.to === 'outside'))
  if (entrances.length === 0) {
    problems.push({
      code: 'house.no-entrance',
      severity: 'error',
      message: 'no door leads outside — nobody can get in',
    })
  }

  for (const room of named) {
    if (room.doors.length === 0) {
      problems.push({
        code: 'room.no-door',
        severity: 'error',
        room: room.name,
        message: `${room.name} has no door`,
      })
    }
  }

  // Walk the house from its entrances, door by door.
  const reached = new Set<string>()
  const queue = entrances.map((room) => room.name!)
  while (queue.length > 0) {
    const name = queue.shift()!
    if (reached.has(name)) continue
    reached.add(name)
    const room = named.find((candidate) => candidate.name === name)
    for (const door of room?.doors ?? []) {
      if (door.to !== 'outside' && !reached.has(door.to)) queue.push(door.to)
    }
  }
  if (entrances.length > 0) {
    for (const room of named) {
      if (!reached.has(room.name!) && room.doors.length > 0) {
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

/** A bedroom or a bathroom does not open straight onto the kitchen or the living room. */
function privacy(rooms: RoomReport[]): Problem[] {
  const problems: Problem[] = []
  const kinds = new Map(rooms.map((room) => [room.name, kindOf(room.name)] as const))
  for (const room of rooms) {
    const kind = kinds.get(room.name)
    if (!kind || !['bedroom', 'bathroom', 'half-bath'].includes(kind.id)) continue
    const interior = room.doors.filter((door) => door.to !== 'outside')
    if (interior.length === 0) continue
    const onlyPublic = interior.every((door) => kinds.get(door.to)?.public)
    if (onlyPublic) {
      problems.push({
        code: 'room.opens-to-public',
        severity: 'warning',
        room: room.name,
        message: `${room.name} opens straight into ${interior.map((door) => door.to).join(' and ')} — a ${kind.label.toLowerCase()} wants a hall between`,
      })
    }
  }
  return problems
}

/** A room is big enough to be what it is called, and not a corridor unless it is one. */
function sizes(rooms: RoomReport[]): Problem[] {
  const problems: Problem[] = []
  for (const room of rooms) {
    const kind = kindOf(room.name)
    if (!kind) continue
    if (room.areaM2 < kind.minArea) {
      problems.push({
        code: 'room.too-small',
        severity: 'warning',
        room: room.name,
        message: `${room.name} is ${room.areaM2} m², and a ${kind.label.toLowerCase()} wants ${kind.minArea} m²`,
      })
    }
    const ratio = Math.max(room.width, room.depth) / Math.max(1, Math.min(room.width, room.depth))
    if (!kind.passage && ratio > 3) {
      problems.push({
        code: 'room.bad-ratio',
        severity: 'warning',
        room: room.name,
        message: `${room.name} is ${room.width} by ${room.depth} mm — ${ratio.toFixed(1)} times as long as it is wide`,
      })
    }
  }
  return problems
}

/** A room somebody lives in has a window. */
function windows(rooms: RoomReport[]): Problem[] {
  return rooms
    .filter((room) => kindOf(room.name)?.needsWindow && room.windows.length === 0)
    .map((room) => ({
      code: 'window.missing',
      severity: 'warning' as const,
      room: room.name,
      message: `${room.name} has no window`,
    }))
}

/** A kitchen has somewhere to wash, cook and keep food. */
function kitchens(doc: HouseDocument, level: string, rooms: Room[]): Problem[] {
  const problems: Problem[] = []
  for (const room of rooms) {
    if (kindOf(room.name)?.id !== 'kitchen') continue
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

/** A door can be opened: nothing stands in its swing, and no other door swings into it. */
function doors(doc: HouseDocument, level: string, rooms: Room[]): Problem[] {
  const problems: Problem[] = []
  const byId = new Map(rooms.filter((room) => room.id).map((room) => [room.id!, room] as const))
  // Only what stands on the floor is in a door's way: a door swings over a rug,
  // and a lamp on a table is in the way only as much as the table is.
  const standing = Object.values(doc.objects)
    .filter((object) => object.level === level && layerOf(object.type) === 'floor')
    .flatMap((object) => {
      const room = byId.get(object.room)
      const spot = room && standingAt(doc, level, room, object)
      return spot ? [{ object, room, box: boxOf(footprintOf(spot, object)) }] : []
    })
  const swings = Object.values(doc.openings)
    .filter((opening) => opening.kind === 'door' && doc.walls[opening.wall]?.level === level)
    .flatMap((opening) => {
      const box = swingOf(doc, opening)
      return box ? [{ opening, box }] : []
    })

  for (const { opening, box } of swings) {
    const into = roomOfSwing(doc, rooms, box)
    const where = into?.name ? ` in ${into.name}` : ''
    const blocked = standing.find((thing) => clashes(box, thing.box))
    if (blocked) {
      problems.push({
        code: 'door.blocked',
        severity: 'error',
        room: into?.name,
        message: `a door${where} cannot open: the ${label(blocked.object)} stands in its swing`,
      })
    }
    const other = swings.find((it) => it.opening.id !== opening.id && clashes(box, it.box))
    if (other && opening.id < other.opening.id) {
      problems.push({
        code: 'door.clash',
        severity: 'warning',
        room: into?.name,
        message: `two doors${where} swing into each other`,
      })
    }
  }
  return problems
}

/** Everything stands where a command would let it stand. */
function standing(doc: HouseDocument, level: string, rooms: Room[]): Problem[] {
  const problems: Problem[] = []
  for (const room of rooms) {
    if (!room.id) continue
    for (const object of objectsIn(doc, level, room)) {
      const spot = {
        ...(object.against ? { against: object.against } : {}),
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

const label = (object: HouseObject) => objectType(object.type)?.label.toLowerCase() ?? object.type

/** The room a door swings into: the one holding the middle of its swing. */
function roomOfSwing(doc: HouseDocument, rooms: Room[], box: Box): Room | undefined {
  const middle = { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 }
  return rooms.find((room) => {
    const polygon = room.nodes.map((id) => doc.nodes[id]).filter((node) => node !== undefined)
    return inside(polygon, middle)
  })
}

function inside(polygon: { x: number; y: number }[], point: { x: number; y: number }): boolean {
  let hit = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]!
    const b = polygon[j]!
    const crosses = a.y > point.y !== b.y > point.y
    if (crosses && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) hit = !hit
  }
  return hit
}
