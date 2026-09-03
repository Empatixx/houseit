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
import { sideFacing, sideRun, sideRuns } from '@houseit/geometry/sides'
import { freeSpans } from '@houseit/geometry/spans'
import { footprintOf, standingAt } from '@houseit/geometry/standing'
import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { levelOf, roomNamed, SIDE_NAMES, sideNamed, thingNamed } from './resolve'
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
  summary: 'Measure the plan, a room, one wall of a room, or the clearances round a thing in it',
  args: z.object({
    room: z.string().min(1).optional(),
    /** With a room: that side of it, with what stands and opens on it and what is free. */
    side: z.enum(SIDE_NAMES).optional(),
    /** Or one wall of it by id from describe, the same way. */
    wall: z.string().min(1).optional(),
    /** With a room: the last thing of this type put there, and its distance to each wall. */
    type: z.enum(OBJECT_TYPE_IDS as [string, ...string[]]).optional(),
    /** Which one of that type, counting from one. Left out, the last. */
    nth: z.coerce.number().int().positive().optional(),
    /** Or a thing by its id from describe. */
    id: z.string().min(1).optional(),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'measure')
    if (args.id !== undefined) {
      const { object, room } = thingNamed(draft, level, args, 'measure')
      return measureObject(draft, level, room, object)
    }
    if (args.room === undefined) {
      if (args.side !== undefined || args.wall !== undefined || args.type !== undefined) {
        throw new CommandError('measure: --side, --wall and --type say which room with --room')
      }
      return measureLevel(draft, level)
    }
    const room = roomNamed(draft, level, args.room, 'measure')
    if (args.type !== undefined) {
      return measureObject(draft, level, room, thingNamed(draft, level, args, 'measure').object)
    }
    if (args.side !== undefined || args.wall !== undefined) {
      const at = sideNamed(draft, level, room, args, 'measure')
      return measureSide(draft, level, room, at.side, at.nth)
    }
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
 * One wall of a room as a line to put things along: its clear length, what is
 * on it already — openings and whatever backs onto it — as stretches from the
 * west or south end, and the stretches left. The `from` and `to` are the
 * millimetres a `--along` of the length lands on.
 */
function measureSide(doc: HouseDocument, level: string, room: Room, side: Side, nth?: number) {
  const run = sideRun(doc, level, room, side, nth)
  if (!run) throw new CommandError(`measure: ${room.name} has no wall facing ${side}`)
  const length = run.length || 1
  const unit = { x: (run.to.x - run.from.x) / length, y: (run.to.y - run.from.y) / length }
  const project = (point: Point) =>
    (point.x - run.from.x) * unit.x + (point.y - run.from.y) * unit.y

  const walls = new Set(run.walls.map((wall) => wall.wall))
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
          id: opening.id,
          kind: opening.kind,
          from: Math.round(centre - opening.width / 2),
          to: Math.round(centre + opening.width / 2),
        },
      ]
    })

  const longest = sideRun(doc, level, room, side)
  const objects = objectsIn(doc, level, room)
    .filter((object) => object.against === side && (object.againstNth ?? longest?.nth) === run.nth)
    .flatMap((object) => {
      const spot = standingAt(doc, level, room, object)
      if (!spot) return []
      const reach = footprintOf(spot, object).map(project)
      return [
        {
          id: object.id,
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
    ...(sideRuns(doc, level, room, side).length > 1 ? { nth: run.nth } : {}),
    walls: run.walls.map((wall) => wall.wall),
    length: run.length,
    thickness: run.thickness,
    openings,
    objects,
    free,
  }
}

function measureObject(
  doc: HouseDocument,
  level: string,
  room: Room & { id: string },
  found: ReturnType<typeof thingNamed>['object'],
) {
  const label = objectType(found.type)?.label.toLowerCase() ?? found.type
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
