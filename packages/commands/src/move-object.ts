import { layerOf, OBJECT_TYPE_IDS, objectType } from '@houseit/core/object-types'
import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { placeAgainst, type Spot } from './place-object'
import { levelOf, objectNamed, roomNamed } from './resolve'
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
    room: z.string().min(1),
    type: z.enum(OBJECT_TYPE_IDS as [string, ...string[]]),
    /** Which one, when there are several: 1 for the first put in. Left out, the last. */
    nth: z.coerce.number().int().positive().optional(),
    against: z.enum(['north', 'south', 'east', 'west']).optional(),
    along: z.coerce.number().min(0).max(1).optional(),
    /** Out in the room, this far up it: 0 south, 1 north. Takes the thing off any wall. */
    across: z.coerce.number().min(0).max(1).optional(),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'move-object')
    const room = roomNamed(draft, level, args.room, 'move-object')
    const found = objectNamed(draft, level, room, args.type, args.nth, 'move-object')
    const label = objectType(found.type)?.label.toLowerCase() ?? found.type

    if (args.against === undefined && args.along === undefined && args.across === undefined) {
      throw new CommandError('move-object: say where to — --against, --along or --across')
    }
    if (args.against !== undefined && args.across !== undefined) {
      throw new CommandError('move-object: a thing is against a wall or across the room, not both')
    }

    const spots = spotsFor(draft, level, room, found, args)
    let problem: string | undefined
    const spot = spots.find((candidate) => {
      problem ??= standingProblem(draft, level, room, candidate, found, found.id)
      return canStand(draft, level, room, candidate, found, found.id)
    })
    if (!spot) {
      const where =
        args.across !== undefined
          ? `out in ${room.name}`
          : `against the ${args.against ?? found.against} side of ${room.name}`
      throw new CommandError(
        `move-object: the ${label} cannot go ${where}${problem ? `: ${problem}` : ''}`,
      )
    }

    const target = draft.objects[found.id]!
    if (spot.against) target.against = spot.against
    else delete target.against
    target.along = spot.along
    if (spot.across !== undefined) target.across = spot.across
    else delete target.across
  },
})

type Where = { against?: Spot['against']; along?: number; across?: number }

/** The places to try, from what was said and what the thing already had. */
function spotsFor(
  draft: Parameters<typeof canStand>[0],
  level: string,
  room: ReturnType<typeof roomNamed>,
  found: { type: string; width: number; depth: number; turn?: number } & Where,
  args: Where,
): Spot[] {
  // Across the room: free-standing, at the place said or the place it had.
  if (args.across !== undefined) {
    return [{ along: args.along ?? found.along ?? 0.5, across: args.across }]
  }

  const side = args.against ?? found.against
  // No side at all: a free thing slid along the room.
  if (side === undefined) {
    return [
      {
        along: args.along ?? found.along ?? 0.5,
        ...(found.across !== undefined ? { across: found.across } : {}),
      },
    ]
  }

  // A side and a place on it, or a side and the place chosen for it.
  if (args.along !== undefined) return [{ against: side, along: args.along }]
  if (args.against === undefined || args.against === found.against) {
    return [{ against: side, along: found.along ?? 0.5 }]
  }
  const type = objectType(found.type)
  return placeAgainst(
    draft,
    level,
    room,
    side,
    takenBy(found).width,
    layerOf(found.type),
    type?.abuts ?? false,
  )
}
