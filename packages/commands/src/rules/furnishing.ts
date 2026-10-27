import type { HouseDocument, HouseObject } from '@houseit/core/document'
import { partsOf } from '@houseit/core/footprint'
import {
  CHAIR,
  FACES_ROOM,
  ROOM_NEEDS,
  SCREEN,
  SEATS_AT,
  seatsOf,
  sleepersOf,
  spaceToUse,
  TOILET,
  type UseSpace,
  WASHER,
  WATCHES,
} from '@houseit/core/furnishing'
import { levelsOf } from '@houseit/core/levels'
import { layerOf } from '@houseit/core/object-types'
import { roomKindOf } from '@houseit/core/room-kinds'
import { COMPASS, frontOf, lookAhead, obstaclesOn, said } from '@houseit/geometry/ahead'
import { type Box, boxOf, clashesAny, INSIDE_A_WALL, wallBox } from '@houseit/geometry/boxes'
import { fitsInside } from '@houseit/geometry/fits'
import type { Point } from '@houseit/geometry/outlines'
import type { Room } from '@houseit/geometry/rooms'
import { onPlan, piecesOf, type Spot, standingAt } from '@houseit/geometry/standing'
import { label, type Problem, type Rule } from './rule'

const stoodIn = (doc: HouseDocument, level: string, room: Room, object: HouseObject) =>
  standingAt(doc, level, room, object)

export const furnishing: Rule = ({ doc, level, rooms }) => {
  const problems: Problem[] = []
  const objects = Object.values(doc.objects).filter((object) => object.level === level)
  const inRoom = (room: Room) => objects.filter((object) => object.room === room.id)
  const wcHere = rooms.some(
    (room) =>
      roomKindOf(room)?.id === 'half-bath' && inRoom(room).some((it) => TOILET.test(it.type)),
  )

  for (const room of rooms) {
    if (!room.id) continue
    const kind = roomKindOf(room)?.id
    const types = inRoom(room).map((object) => object.type)
    const needs = [...(kind ? (ROOM_NEEDS[kind] ?? []) : [])]
    if (kind === 'bathroom' && !wcHere) needs.push({ what: 'a toilet', types: TOILET })
    const missing = needs.filter((need) => !types.some((type) => need.types.test(type)))
    if (missing.length > 0)
      problems.push({
        code: 'room.unfurnished',
        severity: 'warning',
        room: room.name,
        message: `${room.name} still needs ${listed(missing.map((need) => need.what))}`,
      })
    problems.push(...cramped(doc, level, room, inRoom(room)))
    problems.push(...turnedAway(doc, level, room, inRoom(room), rooms))
    problems.push(...loose(doc, level, room, inRoom(room), rooms))
    problems.push(...backToScreen(doc, level, room, inRoom(room)))
  }
  if (levelsOf(doc)[0]?.id === level) problems.push(...dwelling(doc))
  return problems
}

const listed = (items: string[]) =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`

const FACING = 1000
const AT_TABLE = 600

function backToScreen(
  doc: HouseDocument,
  level: string,
  room: Room,
  things: HouseObject[],
): Problem[] {
  const screen = things.find((thing) => SCREEN.test(thing.type))
  const there = screen && stoodIn(doc, level, room, screen)
  if (!screen || !there) return []
  return things.flatMap((seat) => {
    if (!WATCHES.test(seat.type)) return []
    const spot = stoodIn(doc, level, room, seat)
    if (!spot) return []
    const { direction } = frontOf(spot, seat)
    const toward = { x: there.at.x - spot.at.x, y: there.at.y - spot.at.y }
    const length = Math.hypot(toward.x, toward.y) || 1
    if ((direction.x * toward.x + direction.y * toward.y) / length > 0.5) return []
    return [
      {
        code: 'object.back-to-screen',
        severity: 'warning' as const,
        room: room.name,
        ids: [seat.id, screen.id],
        message: `the ${label(seat)} ${seat.id} in ${room.name ?? 'an unnamed room'} faces ${COMPASS(direction)}, away from the ${label(screen)} ${screen.id}: turn it with facing: '${screen.id}'`,
      },
    ]
  })
}

function loose(
  doc: HouseDocument,
  level: string,
  room: Room,
  things: HouseObject[],
  rooms: Room[],
): Problem[] {
  return things.flatMap((chair) => {
    if (!CHAIR.test(chair.type)) return []
    const spot = stoodIn(doc, level, room, chair)
    if (!spot) return []
    const { from, direction } = frontOf(spot, chair)
    const seen = lookAhead(doc, from, direction, obstaclesOn(doc, level, rooms), [chair.id])
    const at = seen?.id ? doc.objects[seen.id] : undefined
    if (at && SEATS_AT.test(at.type) && seen!.distance <= AT_TABLE) return []
    const table = things.find((thing) => SEATS_AT.test(thing.type))
    return [
      {
        code: 'object.chair-alone',
        severity: 'warning' as const,
        room: room.name,
        ids: [chair.id, ...(table ? [table.id] : [])],
        message: `the ${label(chair)} ${chair.id} in ${room.name ?? 'an unnamed room'} is not at a desk or table: it faces ${COMPASS(direction)}, towards ${said(seen)}${table ? `. Put it in front of the ${label(table)} ${table.id} and turn it with facing: '${table.id}'` : ''}`,
      },
    ]
  })
}

function turnedAway(
  doc: HouseDocument,
  level: string,
  room: Room,
  things: HouseObject[],
  rooms: Room[],
): Problem[] {
  return things.flatMap((thing) => {
    if (!FACES_ROOM.test(thing.type)) return []
    const spot = stoodIn(doc, level, room, thing)
    if (!spot) return []
    const { from, direction } = frontOf(spot, thing)
    const seen = lookAhead(doc, from, direction, obstaclesOn(doc, level, rooms), [thing.id])
    if (!seen || seen.id !== undefined || seen.distance >= FACING) return []
    return [
      {
        code: 'object.faces-wall',
        severity: 'warning' as const,
        room: room.name,
        ids: [thing.id],
        message: `the ${label(thing)} in ${room.name ?? 'an unnamed room'} faces ${COMPASS(direction)} into the wall ${seen.distance} mm away: turn it to face the room (rotation 180, or another side)`,
      },
    ]
  })
}

function cramped(doc: HouseDocument, level: string, room: Room, things: HouseObject[]) {
  const problems: Problem[] = []
  const walls = Object.values(doc.walls)
    .filter((wall) => wall.level === level)
    .flatMap((wall) => {
      const from = doc.nodes[wall.a]
      const to = doc.nodes[wall.b]
      return from && to ? [wallBox(from, to, wall.thickness)] : []
    })
  const placed = things.flatMap((thing) => {
    const spot = stoodIn(doc, level, room, thing)
    return spot ? [{ thing, spot, boxes: piecesOf(spot, thing).map(boxOf) }] : []
  })
  for (const { thing, spot } of placed) {
    const space = spaceToUse(thing.type)
    if (!space || partsOf(thing.type).length > 1) continue
    const strips = stripsOf(space, thing, spot)
    if (strips.length === 0) continue
    const blocked = strips.map((strip) => blockerOf(doc, room, strip, walls, placed, thing, space))
    const either = space.sides !== undefined && !space.bothSides?.(thing)
    const failed = either ? blocked.every(Boolean) : blocked.some(Boolean)
    if (!failed) continue
    const by = blocked.find(Boolean)!
    const clear = space.front ?? space.sides
    problems.push({
      code: 'object.no-room-to-use',
      severity: 'warning',
      room: room.name,
      ids: [thing.id, ...(typeof by === 'string' ? [] : [by.id])],
      message: `the ${label(thing)} in ${room.name ?? 'an unnamed room'} wants ${clear} mm clear ${space.front !== undefined ? 'in front of it' : 'beside it'} ${space.why}, and ${typeof by === 'string' ? by : `the ${label(by)}`} is in the way`,
    })
  }
  return problems
}

function stripsOf(space: UseSpace, thing: HouseObject, spot: Spot): Point[][] {
  const rect = (x0: number, y0: number, x1: number, y1: number) =>
    [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ].map((point) => onPlan(spot, thing, point))
  if (space.front !== undefined)
    return [rect(0, thing.depth, thing.width, thing.depth + space.front)]
  if (space.sides === undefined) return []
  const head = Math.min(600, thing.depth / 3)
  return [
    rect(-space.sides, head, 0, thing.depth),
    rect(thing.width, head, thing.width + space.sides, thing.depth),
  ]
}

function blockerOf(
  doc: HouseDocument,
  room: Room,
  strip: Point[],
  walls: Box[],
  placed: { thing: HouseObject; boxes: Box[] }[],
  self: HouseObject,
  space: UseSpace,
): HouseObject | string | undefined {
  const box = [boxOf(strip)]
  if (!fitsInside(doc, room, strip) || clashesAny(box, walls, INSIDE_A_WALL)) return 'the wall'
  return placed.find(
    ({ thing, boxes }) =>
      thing.id !== self.id &&
      layerOf(thing.type) === 'floor' &&
      !space.allows?.test(thing.type) &&
      clashesAny(box, boxes),
  )?.thing
}

function dwelling(doc: HouseDocument): Problem[] {
  const indoors = Object.values(doc.objects).filter((object) => {
    const room = doc.rooms[object.room]
    return !(room && roomKindOf(room)?.outdoor)
  })
  const problems: Problem[] = []
  const sleepers = indoors.reduce((sum, object) => sum + sleepersOf(object), 0)
  const seats = indoors.reduce((sum, object) => sum + seatsOf(object), 0)
  if (sleepers > 0 && seats < sleepers)
    problems.push({
      code: 'flat.table-short',
      severity: 'warning',
      message: `${sleepers} sleep here and the tables seat ${seats}: a household eats together`,
    })
  if (sleepers > 0 && !indoors.some((object) => WASHER.test(object.type)))
    problems.push({
      code: 'flat.no-washer',
      severity: 'warning',
      message:
        'nowhere to wash clothes: a washing machine belongs in the bathroom or a utility room',
    })
  return problems
}
