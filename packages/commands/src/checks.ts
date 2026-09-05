import type { HouseDocument, HouseObject, Level } from '@houseit/core/document'
import { levelAbove, levelBelow } from '@houseit/core/levels'
import { layerOf, objectType } from '@houseit/core/object-types'
import { roomKindOf } from '@houseit/core/room-kinds'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { footprintOf, standingAt } from '@houseit/geometry/standing'
import { stairwaysOn, type Well } from '@houseit/geometry/wells'
import { type Box, boxOf, clashes, wallBox } from './boxes'
import { swingOf } from './place-opening'
import { standingProblem } from './standing-check'
import { type OpeningReport, objectsIn, type RoomReport, surveyLevel } from './survey'

/**
 * Reads the plan for trouble: a room nobody can get to, a bedroom opening
 * straight into the kitchen, a door that cannot swing for the sofa in front
 * of it, a laundry too small to be one, a living room with no window. Empty is
 * what a finished plan gets.
 *
 * Not a command. It runs after every command that changes anything, and the
 * list rides along in the answer — so the command that put the chair in the
 * doorway is the one that says the door cannot open, rather than a separate
 * question asked later by somebody who suspected it already.
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
    ...stairs(doc, level),
  ]
  return problems.sort((one, other) => rank(one) - rank(other))
}

const rank = (problem: Problem) => (problem.severity === 'error' ? 0 : 1)

/** The doors of a room, which are the openings anybody walks through. */
const doorsOf = (room: RoomReport): OpeningReport[] =>
  room.openings.filter((opening) => opening.kind === 'door')

/** Every room has a door, and every room can be walked to from the front door. */
function reach(rooms: RoomReport[]): Problem[] {
  const problems: Problem[] = []
  if (rooms.length === 0) return problems

  const named = rooms.filter((room) => room.name !== undefined)
  const entrances = named.filter((room) => doorsOf(room).some((door) => door.to === 'outside'))
  if (entrances.length === 0) {
    problems.push({
      code: 'house.no-entrance',
      severity: 'error',
      message: 'no door leads outside — nobody can get in',
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

  // Walk the house from its entrances, door by door.
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
  if (entrances.length > 0) {
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

/** A bedroom or a bathroom does not open straight onto the kitchen or the living room. */
function privacy(rooms: RoomReport[]): Problem[] {
  const problems: Problem[] = []
  const kinds = new Map(rooms.map((room) => [room.name, roomKindOf(room)] as const))
  for (const room of rooms) {
    const kind = kinds.get(room.name)
    if (!kind || !['bedroom', 'bathroom', 'half-bath'].includes(kind.id)) continue
    const interior = doorsOf(room).filter((door) => door.to !== 'outside')
    if (interior.length === 0) continue
    const onlyPublic = interior.every((door) => kinds.get(door.to ?? '')?.public)
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
    const kind = roomKindOf(room)
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
    .filter(
      (room) =>
        roomKindOf(room)?.needsWindow &&
        !room.openings.some((opening) => opening.kind === 'window'),
    )
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

/**
 * A staircase has somewhere to go, and something to come up into.
 *
 * A flight is only half a thing on its own storey: the other half is the hole
 * it needs in the floor above. So it is checked against the storey overhead —
 * against a wall standing where the well is, and against whatever else is
 * standing there, since a wardrobe over a stairwell is a wardrobe in mid-air.
 *
 * Both ways round, because either half can be the one that moved. Standing on
 * the first floor and pushing a wardrobe over the stairwell is the same fault
 * as standing on the ground floor and building the stairs under the wardrobe,
 * and whoever did it last is the one who needs telling.
 */
function stairs(doc: HouseDocument, level: string): Problem[] {
  const above = levelAbove(doc, level)
  const below = levelBelow(doc, level)
  return [
    ...stairwaysOn(doc, level).flatMap((well) => climbing(doc, well, above)),
    // Only the blocking, for the storey underneath: whether those stairs have
    // anywhere to go is that storey's own business and is reported there.
    ...(below ? stairwaysOn(doc, below.id).flatMap((well) => blocked(doc, well, level)) : []),
  ]
}

/** What is wrong with a flight leaving this storey, starting with having nowhere to go. */
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

/** Whether the hole this flight needs is where a wall or a wardrobe already is. */
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
    return spot !== undefined && clashes(hole, boxOf(footprintOf(spot, other)), 0)
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

/** Everything stands where a command would let it stand. */
function standing(doc: HouseDocument, level: string, rooms: Room[]): Problem[] {
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
