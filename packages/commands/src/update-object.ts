import { layerOf, objectType } from '@houseit/core/object-types'
import { SURFACE_IDS } from '@houseit/core/surfaces'
import { sideRun } from '@houseit/geometry/sides'
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
import { levelOf, SIDE_NAMES, sideNamed, thingById } from './resolve'
import { canStand, standingProblem, takenBy } from './standing-check'

/**
 * Changes a thing that is already in a room: where it stands, how big it is,
 * which way it is turned, what it is finished in.
 *
 * One command, because they are one question. A sofa made wider and slid along
 * its wall in one line is checked once, on the sofa it becomes — as two
 * commands, each passes on its own and the pair still ends with the sofa in the
 * doorway. Turning is a field like any other: `--rotation 90` is the same shape
 * of thing as `--width 2.4m`, and there is no more a verb for it than there is
 * one for widening.
 *
 * Whatever is not said stays as it was. Say only `--against` and the place on
 * that wall is chosen, as it would be for something new; say `--across` and the
 * thing comes off the wall into the room.
 */
export const updateObject = defineCommand({
  name: 'update-object',
  summary: 'Change a thing in its room: where it stands, its size, its turn, its finish',
  args: z.object({
    /** Its id, as the last answer gave it. */
    id: z.string().min(1),
    /** The side to back onto. */
    against: z.enum(SIDE_NAMES).optional(),
    /** Or the very wall to back onto, by its id. */
    wall: z.string().min(1).optional(),
    /** How far along that wall, or across the room: a fraction, or a length from the west or south end. */
    along: along().optional(),
    /** Out in the room, this far up it: a fraction (0 south, 1 north) or a length from the south. Takes the thing off any wall. */
    across: along().optional(),
    width: length().optional(),
    depth: length().optional(),
    /** Its turn about its own middle, in whole degrees. Absolute, not a nudge. */
    rotation: z.coerce.number().int().min(-359).max(359).optional(),
    surface: z.enum(SURFACE_IDS as [string, ...string[]]).optional(),
    seats: z.coerce.number().int().positive().optional(),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'update-object')
    const { object: found, room } = thingById(draft, level, args.id, 'update-object')
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

    // The thing as it will be, before anywhere is tried: every check below is
    // made on this, so a wider sofa is looked for a place at its new width.
    const shape = {
      ...found,
      width: args.width ?? found.width,
      depth: args.depth ?? found.depth,
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

    let problem: string | undefined
    const spot = spots.find((candidate) => {
      problem ??= standingProblem(draft, level, room, candidate, shape, found.id)
      return canStand(draft, level, room, candidate, shape, found.id)
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

/** Where a thing stands now, in the words a placing is said in. */
const standsAt = (object: Spot & { across?: number }): Spot => ({
  ...(object.against ? { against: object.against } : {}),
  ...(object.againstNth !== undefined ? { againstNth: object.againstNth } : {}),
  along: object.along,
  ...(object.across !== undefined ? { across: object.across } : {}),
})

type Where = { at?: At; along?: Along; across?: number }

/** The places to try, from what was said and what the thing already had. */
function spotsFor(
  draft: Parameters<typeof canStand>[0],
  level: string,
  room: ReturnType<typeof thingById>['room'],
  found: { type: string; width: number; depth: number; rotation?: number } & Spot,
  args: Where,
): Spot[] {
  const free = (spec: Along | undefined, had: number) =>
    spec === undefined ? had : fractionOf(spec, { length: freeWidth(draft, room) }, 'update-object')

  // Across the room: free-standing, at the place said or the place it had.
  if (args.across !== undefined) {
    return [{ along: free(args.along, found.along ?? 0.5), across: args.across }]
  }

  const side = args.at?.side ?? found.against
  // No side at all: a free thing slid along the room.
  if (side === undefined) {
    return [
      {
        along: free(args.along, found.along ?? 0.5),
        ...(found.across !== undefined ? { across: found.across } : {}),
      },
    ]
  }

  // The run of that side: the one asked for, or the one it was on if the side is the same.
  const sameSide = args.at === undefined || args.at.side === found.against
  const nth = args.at?.nth ?? (sameSide ? found.againstNth : undefined)
  const onRun = nth === undefined ? {} : { againstNth: nth }

  // A side and a place on it, or a side and the place chosen for it.
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
