import { layerOf, OBJECT_TYPE_IDS, objectType } from '@houseit/core/object-types'
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
import { freeWidth, placeAgainst, type Spot } from './place-object'
import { levelOf, SIDE_NAMES, sideNamed, thingNamed } from './resolve'
import { canStand, standingProblem, takenBy } from './standing-check'

/**
 * Moves a thing within its room.
 *
 * Said the way it was put there: against a side and how far along, or out in
 * the room by how far across and along. Say only the side and the place on it
 * is chosen, as it would be for a new thing; say `--across` and the thing comes
 * off the wall. Whatever is not said stays as it was. The move is checked the
 * way a placing is, so a thing cannot be moved into a wall or into the sofa —
 * dragging on the plan ends in this command, and that check is what the drag
 * has to pass.
 */
export const moveObject = defineCommand({
  name: 'move-object',
  summary: 'Move a thing in its room: against a side and along it, or out into the room',
  args: z.object({
    /** Its id from describe; or say the room and type. */
    id: z.string().min(1).optional(),
    room: z.string().min(1).optional(),
    type: z.enum(OBJECT_TYPE_IDS as [string, ...string[]]).optional(),
    /** Which one, when there are several: 1 for the first put in. Left out, the last. */
    nth: z.coerce.number().int().positive().optional(),
    against: z.enum(SIDE_NAMES).optional(),
    /** Or the very wall to back onto, by its id from describe. */
    wall: z.string().min(1).optional(),
    /** How far along that wall, or across the room: a fraction, or a length from the west or south end. */
    along: along().optional(),
    /** Out in the room, this far up it: a fraction (0 south, 1 north) or a length from the south. Takes the thing off any wall. */
    across: along().optional(),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'move-object')
    const { object: found, room } = thingNamed(draft, level, args, 'move-object')
    const label = objectType(found.type)?.label.toLowerCase() ?? found.type
    const aimed = args.against !== undefined || args.wall !== undefined

    if (!aimed && args.along === undefined && args.across === undefined) {
      throw new CommandError('move-object: say where to — --against, --wall, --along or --across')
    }
    if (aimed && args.across !== undefined) {
      throw new CommandError('move-object: a thing is against a wall or across the room, not both')
    }
    const at = aimed
      ? sideNamed(draft, level, room, { side: args.against, wall: args.wall }, 'move-object')
      : undefined

    const across =
      args.across === undefined
        ? undefined
        : fractionAcross(draft, room, args.across, 'move-object')
    const spots = spotsFor(draft, level, room, found, { at, along: args.along, across })
    let problem: string | undefined
    const spot = spots.find((candidate) => {
      problem ??= standingProblem(draft, level, room, candidate, found, found.id)
      return canStand(draft, level, room, candidate, found, found.id)
    })
    if (!spot) {
      const where =
        args.across !== undefined
          ? `out in ${room.name}`
          : `against the ${at?.side ?? found.against} side of ${room.name}`
      throw new CommandError(
        `move-object: the ${label} cannot go ${where}${problem ? `: ${problem}` : ''}`,
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
  },
})

type Where = { at?: At; along?: Along; across?: number }

/** The places to try, from what was said and what the thing already had. */
function spotsFor(
  draft: Parameters<typeof canStand>[0],
  level: string,
  room: ReturnType<typeof thingNamed>['room'],
  found: { type: string; width: number; depth: number; turn?: number } & Spot,
  args: Where,
): Spot[] {
  const free = (spec: Along | undefined, had: number) =>
    spec === undefined ? had : fractionOf(spec, { length: freeWidth(draft, room) }, 'move-object')

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
        along: alongSide(draft, level, room, at, args.along, 'move-object'),
      },
    ]
  }
  if (sameSide && args.at?.nth === undefined) {
    return [{ against: side, ...onRun, along: found.along ?? 0.5 }]
  }
  const type = objectType(found.type)
  const run = sideRun(draft, level, room, side, nth)
  const window = run ? windowOf(run, at, room, 'move-object') : undefined
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
