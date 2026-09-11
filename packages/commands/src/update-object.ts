import type { HouseDocument } from '@houseit/core/document'
import { layerOf, objectType } from '@houseit/core/object-types'
import { flightWidthOf, stairKind, stairShape } from '@houseit/core/stairs'
import { SURFACE_IDS } from '@houseit/core/surfaces'
import { containsPoint, type Room, roomsOf } from '@houseit/geometry/rooms'
import { sideRun } from '@houseit/geometry/sides'
import { standingAt } from '@houseit/geometry/standing'
import { z } from 'zod'
import {
  type Along,
  type At,
  along,
  alongSide,
  fractionAcross,
  fractionOf,
  windowOf,
} from './along-schema'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { length } from './length-schema'
import { freeWidth, placeAgainst, type Spot } from './place-object'
import { SIDE_NAMES, sideNamed, thingById } from './resolve'
import { canStand, standingProblem, takenBy } from './standing-check'

export const updateObject = defineCommand({
  name: 'update-object',
  summary: `Change a thing in its room: where it stands, its size, its turn, its finish (${SURFACE_IDS.join(', ')})`,
  args: z.object({
    id: z.string().min(1),
    against: z.enum(SIDE_NAMES).optional(),
    wall: z.string().min(1).optional(),
    along: along().optional(),
    across: along().optional(),
    width: length().optional(),
    depth: length().optional(),
    rotation: z.coerce.number().int().min(-359).max(359).optional(),
    surface: z.enum(SURFACE_IDS as [string, ...string[]]).optional(),
    seats: z.coerce.number().int().positive().optional(),
  }),
  run: (draft, args) => {
    const { object: found, room, level } = thingById(draft, args.id, 'update-object')
    const type = objectType(found.type)
    const label = type?.label.toLowerCase() ?? found.type

    const aimed = args.against !== undefined || args.wall !== undefined
    const moving = aimed || args.along !== undefined || args.across !== undefined
    const changing =
      args.width !== undefined ||
      args.depth !== undefined ||
      args.rotation !== undefined ||
      args.surface !== undefined ||
      args.seats !== undefined
    if (!moving && !changing) {
      throw new CommandError(
        'update-object: say what to change — --against, --wall, --along, --across, --width, --depth, --rotation, --surface or --seats',
      )
    }
    if (aimed && args.across !== undefined) {
      throw new CommandError(
        'update-object: a thing is against a wall or across the room, not both',
      )
    }
    if (args.surface !== undefined && type && !type.surfaces.includes(args.surface)) {
      throw new CommandError(
        `update-object: a ${label} does not come in ${args.surface} — only ${type.surfaces.join(', ')}`,
      )
    }

    const climb = stairKind(found.type)
    const height = draft.levels[level]!.height
    const flight = climb
      ? stairShape(climb, height, args.width ?? flightWidthOf(climb, found.width, height))
      : undefined
    if (flight && args.depth !== undefined) {
      throw new CommandError(
        `update-object: a staircase is as long as the storey makes it — ${flight.size.depth} mm for ${flight.risers} risers`,
      )
    }

    const shape = {
      ...found,
      width: flight?.size.width ?? args.width ?? found.width,
      depth: flight?.size.depth ?? args.depth ?? found.depth,
      ...(args.rotation === undefined
        ? {}
        : { rotation: args.rotation === 0 ? undefined : args.rotation }),
    }

    const at = aimed
      ? sideNamed(draft, level, room, { side: args.against, wall: args.wall }, 'update-object')
      : undefined
    const across =
      args.across === undefined
        ? undefined
        : fractionAcross(draft, room, args.across, 'update-object')
    const spots = moving
      ? spotsFor(draft, level, room, shape, { at, along: args.along, across })
      : [standsAt(found)]

    const how = { overhang: moving }
    let problem: string | undefined
    const spot = spots.find((candidate) => {
      problem ??= standingProblem(draft, level, room, candidate, shape, found.id, how)
      return canStand(draft, level, room, candidate, shape, found.id, how)
    })
    if (!spot) {
      const why = problem ? `: ${problem}` : ''
      throw new CommandError(
        moving
          ? args.across !== undefined
            ? `update-object: the ${label} cannot go out into ${room.name}${why}`
            : `update-object: the ${label} cannot go against the ${at?.side ?? found.against} side of ${room.name}${why}`
          : `update-object: a ${shape.width} by ${shape.depth} mm ${label} does not fit where it stands in ${room.name}${why}`,
      )
    }

    const landed = whereItCameDown(draft, level, room, spot, shape)
    if (landed) {
      const why = standingProblem(draft, level, landed.room, landed.spot, shape, found.id, {
        overhang: true,
      })
      if (why) {
        throw new CommandError(
          `update-object: the ${label} cannot go into ${landed.room.name ?? 'the room next door'}: ${why}`,
        )
      }
      settle(draft.objects[found.id]!, landed.spot, shape)
      draft.objects[found.id]!.room = landed.room.id
      if (args.surface !== undefined) draft.objects[found.id]!.surface = args.surface
      if (args.seats !== undefined) draft.objects[found.id]!.seats = args.seats
      return {
        changed: [found.id, room.id, landed.room.id],
        notes: [
          `the ${label} went from ${room.name ?? 'a room'} into ${landed.room.name ?? 'the room next door'}`,
        ],
      }
    }

    const target = draft.objects[found.id]!
    if (spot.against) target.against = spot.against
    else delete target.against
    if (spot.againstNth !== undefined) target.againstNth = spot.againstNth
    else delete target.againstNth
    target.along = spot.along
    if (spot.across !== undefined) target.across = spot.across
    else delete target.across
    target.width = shape.width
    target.depth = shape.depth
    if (shape.rotation === undefined) delete target.rotation
    else target.rotation = shape.rotation
    if (args.surface !== undefined) target.surface = args.surface
    if (args.seats !== undefined) target.seats = args.seats
    return { changed: [found.id] }
  },
})

function whereItCameDown(
  draft: Parameters<typeof canStand>[0],
  level: string,
  room: ReturnType<typeof thingById>['room'],
  spot: Spot,
  shape: { width: number; depth: number; rotation?: number },
): { room: Room & { id: string }; spot: Spot } | undefined {
  const at = standingAt(draft as HouseDocument, level, room, {
    width: shape.width,
    depth: shape.depth,
    ...(shape.rotation === undefined ? {} : { rotation: shape.rotation }),
    along: spot.along,
    ...(spot.against ? { against: spot.against } : {}),
    ...(spot.againstNth === undefined ? {} : { againstNth: spot.againstNth }),
    ...(spot.across === undefined ? {} : { across: spot.across }),
  })
  if (!at) return undefined

  const landed = roomsOf(draft, level).find((candidate) => {
    if (candidate.id === undefined || candidate.id === room.id) return false
    const outline = candidate.nodes
      .map((id) => draft.nodes[id])
      .filter((node) => node !== undefined)
    return containsPoint(outline, at.at.x, at.at.y)
  })
  if (!landed?.id) return undefined

  const corners = landed.nodes.map((id) => draft.nodes[id]!)
  const xs = corners.map((corner) => corner.x)
  const ys = corners.map((corner) => corner.y)
  return {
    room: landed as Room & { id: string },
    spot: {
      along: round((at.at.x - Math.min(...xs)) / Math.max(1, Math.max(...xs) - Math.min(...xs))),
      across: round((at.at.y - Math.min(...ys)) / Math.max(1, Math.max(...ys) - Math.min(...ys))),
    },
  }
}

function settle(
  target: {
    along: number
    across?: number
    against?: unknown
    againstNth?: unknown
    width: number
    depth: number
    rotation?: number
  },
  spot: Spot,
  shape: { width: number; depth: number; rotation?: number },
): void {
  delete target.against
  delete target.againstNth
  target.along = spot.along
  if (spot.across !== undefined) target.across = spot.across
  target.width = shape.width
  target.depth = shape.depth
  if (shape.rotation === undefined) delete target.rotation
  else target.rotation = shape.rotation
}

const round = (fraction: number) => Math.round(Math.min(1, Math.max(0, fraction)) * 1000) / 1000

const standsAt = (object: Spot & { across?: number }): Spot => ({
  ...(object.against ? { against: object.against } : {}),
  ...(object.againstNth !== undefined ? { againstNth: object.againstNth } : {}),
  along: object.along,
  ...(object.across !== undefined ? { across: object.across } : {}),
})

type Where = { at?: At; along?: Along; across?: number }

function spotsFor(
  draft: Parameters<typeof canStand>[0],
  level: string,
  room: ReturnType<typeof thingById>['room'],
  found: { type: string; width: number; depth: number; rotation?: number } & Spot,
  args: Where,
): Spot[] {
  const free = (spec: Along | undefined, had: number) =>
    spec === undefined ? had : fractionOf(spec, { length: freeWidth(draft, room) }, 'update-object')

  if (args.across !== undefined) {
    return [{ along: free(args.along, found.along ?? 0.5), across: args.across }]
  }

  const side = args.at?.side ?? found.against
  if (side === undefined) {
    return [
      {
        along: free(args.along, found.along ?? 0.5),
        ...(found.across !== undefined ? { across: found.across } : {}),
      },
    ]
  }

  const sameSide = args.at === undefined || args.at.side === found.against
  const nth = args.at?.nth ?? (sameSide ? found.againstNth : undefined)
  const onRun = nth === undefined ? {} : { againstNth: nth }

  const at: At = { side, nth, ...(args.at?.wall !== undefined ? { wall: args.at.wall } : {}) }
  if (args.along !== undefined) {
    return [
      {
        against: side,
        ...onRun,
        along: alongSide(draft, level, room, at, args.along, 'update-object'),
      },
    ]
  }
  if (sameSide && args.at?.nth === undefined) {
    return [{ against: side, ...onRun, along: found.along ?? 0.5 }]
  }
  const type = objectType(found.type)
  const run = sideRun(draft, level, room, side, nth)
  const window = run ? windowOf(run, at, room, 'update-object') : undefined
  return placeAgainst(
    draft,
    level,
    room,
    side,
    takenBy(found).width,
    layerOf(found.type),
    type?.abuts ?? false,
    nth,
    window,
  )
}
