import type { HouseDocument, Side } from '@houseit/core/document'
import { OBJECT_TYPE_IDS, objectType } from '@houseit/core/object-types'
import {
  interiorSize,
  objectClearances,
  planExtent,
  roomDimensions,
} from '@houseit/geometry/dimensions'
import type { Point } from '@houseit/geometry/outlines'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { sideFacing, sideRun, wallsOnSide } from '@houseit/geometry/sides'
import { freeSpans } from '@houseit/geometry/spans'
import { footprintOf, standingAt } from '@houseit/geometry/standing'
import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { levelOf, newest, roomNamed } from './resolve'
import { objectsIn, surveyObject } from './survey'

/**
 * Puts a tape measure on the plan.
 *
 * The same numbers the editor draws when a room or a thing is picked, said out
 * loud: the plan's outside, a room's clear size and every wall of it, one side
 * of a room with what is already on it and what is still free, or how far a
 * thing stands from the walls round it. Lengths in millimetres, nothing changed.
 */
export const measure = defineCommand({
  name: 'measure',
  summary: 'Measure the plan, a room, one side of a room, or the clearances round a thing in it',
  args: z.object({
    room: z.string().min(1).optional(),
    /** With a room: that side of it, with what stands and opens on it and what is free. */
    side: z.enum(['north', 'south', 'east', 'west']).optional(),
    /** With a room: the last thing of this type put there, and its distance to each wall. */
    type: z.enum(OBJECT_TYPE_IDS as [string, ...string[]]).optional(),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'measure')
    if (args.room === undefined) {
      if (args.side !== undefined || args.type !== undefined) {
        throw new CommandError('measure: --side and --type say which room with --room')
      }
      return measureLevel(draft, level)
    }
    const room = roomNamed(draft, level, args.room, 'measure')
    if (args.type !== undefined) return measureObject(draft, level, room, args.type)
    if (args.side !== undefined) return measureSide(draft, level, room, args.side)
    return measureRoom(draft, level, room)
  },
})

function measureLevel(doc: HouseDocument, level: string) {
  const extent = planExtent(doc, level)
  return {
    level,
    ...(extent
      ? { width: Math.round(extent.x1 - extent.x0), depth: Math.round(extent.y1 - extent.y0) }
      : {}),
    rooms: roomsOf(doc, level).map((room) => measureRoom(doc, level, room)),
  }
}

function measureRoom(doc: HouseDocument, level: string, room: Room) {
  return {
    ...(room.name === undefined ? {} : { room: room.name }),
    areaM2: Math.round(room.area / 10_000) / 100,
    ...interiorSize(doc, level, room),
    walls: roomDimensions(doc, level, room).map((dimension) => ({
      side: sideFacing(dimension.offset),
      length: dimension.length,
    })),
  }
}

/**
 * One side of a room as a line to put things along: its clear length, what is
 * on it already — openings and whatever backs onto it — as stretches from the
 * west or south end, and the stretches left. The `from` and `to` are the
 * millimetres a `--along` fraction of the length lands on.
 */
function measureSide(doc: HouseDocument, level: string, room: Room, side: Side) {
  const run = sideRun(doc, level, room, side)
  if (!run) throw new CommandError(`measure: ${room.name} has no wall facing ${side}`)
  const length = run.length || 1
  const unit = { x: (run.to.x - run.from.x) / length, y: (run.to.y - run.from.y) / length }
  const project = (point: Point) =>
    (point.x - run.from.x) * unit.x + (point.y - run.from.y) * unit.y

  const walls = new Set(wallsOnSide(doc, level, room, side).map((wall) => wall.wall))
  const openings = Object.values(doc.openings)
    .filter((opening) => walls.has(opening.wall))
    .flatMap((opening) => {
      const wall = doc.walls[opening.wall]
      const a = wall && doc.nodes[wall.a]
      const b = wall && doc.nodes[wall.b]
      if (!a || !b) return []
      const centre = project({ x: a.x + (b.x - a.x) * opening.t, y: a.y + (b.y - a.y) * opening.t })
      return [
        {
          kind: opening.kind,
          from: Math.round(centre - opening.width / 2),
          to: Math.round(centre + opening.width / 2),
        },
      ]
    })

  const objects = objectsIn(doc, level, room)
    .filter((object) => object.against === side)
    .flatMap((object) => {
      const spot = standingAt(doc, level, room, object)
      if (!spot) return []
      const reach = footprintOf(spot, object).map(project)
      return [
        {
          type: object.type,
          from: Math.round(Math.min(...reach)),
          to: Math.round(Math.max(...reach)),
        },
      ]
    })

  const taken = [...openings, ...objects].map(({ from, to }) => ({ from, to }))
  const free = freeSpans(run.length, taken).map((span) => ({
    from: Math.round(span.from),
    to: Math.round(span.to),
  }))

  return {
    room: room.name,
    side,
    length: run.length,
    thickness: run.thickness,
    openings,
    objects,
    free,
  }
}

function measureObject(doc: HouseDocument, level: string, room: Room, type: string) {
  const label = objectType(type)?.label.toLowerCase() ?? type
  const found = newest(objectsIn(doc, level, room).filter((object) => object.type === type))
  if (!found) throw new CommandError(`measure: there is no ${label} in ${room.name}`)
  const spot = standingAt(doc, level, room, found)
  if (!spot) throw new CommandError(`measure: the ${label} in ${room.name} has nowhere to stand`)

  const clearances = objectClearances(doc, level, room, spot, found)
  return {
    room: room.name,
    object: surveyObject(doc, level, room, found),
    /** From each side of the thing's box to the face of the first wall that way. */
    clearances: Object.fromEntries(clearances.map((it) => [it.side, it.length])),
  }
}
