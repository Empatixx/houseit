import type { HouseDocument, Opening, Side } from '@houseit/core/document'
import { openingParts } from '@houseit/core/opening-parts'
import { type Box, boxOf, clashes } from '@houseit/geometry/boxes'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { wallsFacing as facing, sideRun } from '@houseit/geometry/sides'
import { freeSpans, type Span, spanAround } from '@houseit/geometry/spans'
import { footprintOf, standingAt } from '@houseit/geometry/standing'
import { sweptBy, swingOf } from '@houseit/geometry/swing'
import { CommandError } from './command-error'
import { directionAt, opensIntoOf } from './opening-direction'

export type { Side }

export type Placement = {
  wall: string
  t: number
  swing: -1 | 1
}

export function placeOpening(
  doc: HouseDocument,
  level: string,
  room: Room,
  side: Side,
  width: number,
  what: string,
  swings = false,
  except?: string,
  nth?: number,
  wall?: string,
  into?: string,
): Placement {
  const walls = wallsFacing(doc, level, room, side, what, nth)
    .filter((candidate) => wall === undefined || candidate.wall.id === wall)
    .sort((one, other) => spanOf(other) - spanOf(one))
  if (walls.length === 0) {
    throw new CommandError(`${what}: ${wall} is not on the ${side} side of ${room.name}`)
  }
  const widest = spanOf(walls[0]!)
  if (width > widest) {
    throw new CommandError(
      `${what}: ${width} mm does not fit the ${widest} mm wall on the ${side} side of ${room.name}`,
    )
  }

  let roomToStand = false
  for (const chosen of walls) {
    const span = spanOf(chosen)
    if (width > span) continue

    const taken = [
      ...Object.values(doc.openings)
        .filter((opening) => opening.wall === chosen.wall.id && opening.id !== except)
        .map((opening) => spanAround(opening.t * span, opening.width)),
      ...(swings ? standingOn(doc, level, chosen, span) : []),
    ]
    const gaps = freeSpans(span, taken)
      .filter((free) => free.to - free.from >= width)
      .sort((one, other) => other.to - other.from - (one.to - one.from))
    if (gaps.length === 0) continue
    roomToStand = true

    const swing = directionAt(doc, level, chosen.wall.id, room, into, what)
    const tries = gaps.flatMap((free) => [
      (free.from + free.to) / 2,
      free.from + width / 2,
      free.to - width / 2,
    ])
    const at = swings
      ? tries.find((spot) => swingIsClear(doc, level, chosen, span, spot, width, swing, except))
      : tries[0]

    if (at !== undefined) return { wall: chosen.wall.id, t: at / span, swing }
  }

  throw new CommandError(
    roomToStand
      ? `${what}: a ${width} mm door in the ${side} wall of ${room.name} has nowhere to open — ` +
          `everywhere it would fit, something is standing in front of it`
      : `${what}: ${width} mm does not fit beside the openings already in the ${side} wall of ${room.name}`,
  )
}

export function placeOpeningAt(
  doc: HouseDocument,
  level: string,
  room: Room,
  side: Side,
  width: number,
  along: number,
  what: string,
  swings = false,
  except?: string,
  nth?: number,
  into?: string,
): Placement {
  const run = sideRun(doc, level, room, side, nth)
  if (!run) throw new CommandError(`${what}: ${room.name} has no wall facing ${side}`)
  const centre = {
    x: run.from.x + (run.to.x - run.from.x) * along,
    y: run.from.y + (run.to.y - run.from.y) * along,
  }

  const walls = run.walls.map((wall) => ({ wall: { id: wall.wall }, a: wall.a, b: wall.b }))
  const found = walls
    .map((wall) => {
      const span = spanOf(wall)
      const at =
        ((centre.x - wall.a.x) * (wall.b.x - wall.a.x) +
          (centre.y - wall.a.y) * (wall.b.y - wall.a.y)) /
        (span || 1)
      return { wall, span, at }
    })
    .find(({ span, at }) => at >= 0 && at <= span)
  if (!found) {
    throw new CommandError(
      `${what}: there is no wall at ${along} along the ${side} side of ${room.name}`,
    )
  }
  const { wall: chosen, span, at } = found
  const swing = checkOpeningAt(
    doc,
    level,
    room,
    chosen.wall.id,
    at,
    width,
    what,
    swings,
    except,
    into,
  )
  return { wall: chosen.wall.id, t: at / span, swing }
}

export function checkOpeningAt(
  doc: HouseDocument,
  level: string,
  room: Room,
  wallId: string,
  at: number,
  width: number,
  what: string,
  swings = false,
  except?: string,
  into?: string,
): -1 | 1 {
  const wall = doc.walls[wallId]
  const a = wall && doc.nodes[wall.a]
  const b = wall && doc.nodes[wall.b]
  if (!wall || !a || !b) throw new CommandError(`${what}: there is no such wall`)
  const chosen = { wall: { id: wallId }, a, b }
  const span = spanOf(chosen)
  const where = `the wall of ${room.name}`

  if (at - width / 2 < 0 || at + width / 2 > span) {
    throw new CommandError(`${what}: ${width} mm there runs past the end of ${where}`)
  }
  const wanted = spanAround(at, width)
  const overlapping = Object.values(doc.openings).find((opening) => {
    if (opening.wall !== wallId || opening.id === except) return false
    const other = spanAround(opening.t * span, opening.width)
    return other.from < wanted.to && wanted.from < other.to
  })
  if (overlapping) {
    throw new CommandError(
      `${what}: there is already a ${overlapping.kind} at that place in ${where}`,
    )
  }

  const swing = directionAt(doc, level, wallId, room, into, what)
  if (swings && !swingIsClear(doc, level, chosen, span, at, width, swing, except)) {
    throw new CommandError(
      `${what}: a door there could not open — something is standing in its swing`,
    )
  }
  return swing
}

function swingIsClear(
  doc: HouseDocument,
  level: string,
  chosen: Facing,
  span: number,
  at: number,
  width: number,
  swing: -1 | 1,
  except?: string,
): boolean {
  const box = sweptBy(chosen.a, chosen.b, span, at, width, swing)

  const doors = Object.values(doc.openings)
    .filter((opening) => opening.id !== except && doc.walls[opening.wall]?.level === level)
    .flatMap((opening) => {
      const wall = doc.walls[opening.wall]!
      const a = doc.nodes[wall.a]!,
        b = doc.nodes[wall.b]!
      return openingParts(opening, Math.hypot(b.x - a.x, b.y - a.y))
    })
    .map((opening) => swingOf(doc, opening))
    .filter((other): other is Box => other !== undefined)
  if (doors.some((other) => clashes(box, other))) return false

  const rooms = new Map(
    roomsOf(doc, level)
      .filter((room) => room.id)
      .map((room) => [room.id!, room] as const),
  )
  return !Object.values(doc.objects)
    .filter((object) => object.level === level)
    .some((object) => {
      const room = rooms.get(object.room)
      const spot = room && standingAt(doc, level, room, object)
      if (!spot) return false
      return clashes(box, boxOf(footprintOf(spot, object)))
    })
}

function standingOn(doc: HouseDocument, level: string, chosen: Facing, span: number): Span[] {
  const rooms = new Map(
    roomsOf(doc, level)
      .filter((room) => room.id)
      .map((room) => [room.id!, room] as const),
  )
  const unit = {
    x: (chosen.b.x - chosen.a.x) / (span || 1),
    y: (chosen.b.y - chosen.a.y) / (span || 1),
  }
  const reach = (doc.walls[chosen.wall.id]?.thickness ?? 0) / 2 + 120

  return Object.values(doc.objects)
    .filter((object) => object.level === level && object.against !== undefined)
    .flatMap((object) => {
      const room = rooms.get(object.room)
      const spot = room && standingAt(doc, level, room, object)
      if (!spot) return []

      const corners = footprintOf(spot, object).map((corner) => ({
        along: (corner.x - chosen.a.x) * unit.x + (corner.y - chosen.a.y) * unit.y,
        off: Math.abs((corner.x - chosen.a.x) * unit.y - (corner.y - chosen.a.y) * unit.x),
      }))
      if (Math.min(...corners.map((corner) => corner.off)) > reach) return []

      const alongs = corners.map((corner) => corner.along)
      return [{ from: Math.min(...alongs), to: Math.max(...alongs) }]
    })
}

export function wallsFacing(
  doc: HouseDocument,
  level: string,
  room: Room,
  side: Side,
  what: string,
  nth?: number,
): Facing[] {
  const walls =
    nth === undefined
      ? facing(doc, level, room, side)
      : (sideRun(doc, level, room, side, nth)?.walls ?? [])
  if (walls.length === 0) {
    throw new CommandError(`${what}: ${room.name} has no wall facing ${side}`)
  }
  return walls.map((wall) => ({ wall: { id: wall.wall }, a: wall.a, b: wall.b }))
}

type Facing = { wall: { id: string }; a: { x: number; y: number }; b: { x: number; y: number } }

const spanOf = ({ a, b }: { a: { x: number; y: number }; b: { x: number; y: number } }) =>
  Math.round(Math.hypot(b.x - a.x, b.y - a.y))

export function checkDoorLeaves(
  doc: HouseDocument,
  level: string,
  room: Room,
  opening: Opening,
  what: string,
) {
  if (!opening.panels && opening.leafWidth === undefined) return
  const wall = doc.walls[opening.wall]!
  const a = doc.nodes[wall.a]!,
    b = doc.nodes[wall.b]!
  const span = Math.hypot(b.x - a.x, b.y - a.y)
  const into = opensIntoOf(doc, roomsOf(doc, level), opening)
  for (const part of openingParts(opening, span).filter((p) => p.kind === 'door'))
    checkOpeningAt(
      doc,
      level,
      room,
      opening.wall,
      part.t * span,
      part.width,
      what,
      true,
      opening.id,
      into,
    )
}
