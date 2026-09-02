import { OBJECT_TYPE_IDS, objectType } from '@houseit/core/object-types'
import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { levelOf, objectNamed, roomNamed } from './resolve'
import { standingProblem } from './standing-check'

/**
 * Turns a thing about its own middle, in degrees on top of the way it already
 * faces where it stands. `--to` sets the turn; `--by` adds to it, which is what
 * a key on the plan does. Checked like a move: a sofa turned across its wall
 * would stand in the wall, and is refused rather than drawn there.
 */
export const turnObject = defineCommand({
  name: 'turn-object',
  summary: 'Turn a thing in its room, in degrees: to a turn, or by one',
  args: z.object({
    room: z.string().min(1),
    type: z.enum(OBJECT_TYPE_IDS as [string, ...string[]]),
    /** Which one, when there are several: 1 for the first put in. Left out, the last. */
    nth: z.coerce.number().int().positive().optional(),
    to: z.coerce.number().int().min(-359).max(359).optional(),
    by: z.coerce.number().int().min(-359).max(359).optional(),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'turn-object')
    const room = roomNamed(draft, level, args.room, 'turn-object')
    const found = objectNamed(draft, level, room, args.type, args.nth, 'turn-object')
    const label = objectType(found.type)?.label.toLowerCase() ?? found.type

    if ((args.to === undefined) === (args.by === undefined)) {
      throw new CommandError('turn-object: say --to a turn or --by one, and not both')
    }
    const turn = normalise(args.to ?? (found.turn ?? 0) + (args.by ?? 0))

    const spot = {
      ...(found.against ? { against: found.against } : {}),
      along: found.along,
      ...(found.across !== undefined ? { across: found.across } : {}),
    }
    const problem = standingProblem(draft, level, room, spot, { ...found, turn }, found.id)
    if (problem) {
      throw new CommandError(
        `turn-object: the ${label} cannot turn to ${turn}° where it stands in ${room.name}: ${problem}`,
      )
    }

    const target = draft.objects[found.id]!
    if (turn === 0) delete target.turn
    else target.turn = turn
  },
})

/** A turn as one number in (-360, 360), with a full circle taken out. */
const normalise = (degrees: number) => degrees % 360
