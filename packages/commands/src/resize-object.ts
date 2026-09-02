import { OBJECT_TYPE_IDS, objectType } from '@houseit/core/object-types'
import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { length } from './length-schema'
import { levelOf, objectNamed, roomNamed } from './resolve'
import { standingProblem } from './standing-check'

/**
 * Makes a thing another size where it stands: a 2.4 m sofa instead of the
 * 2.2 m one. Checked the way a move is, since a bigger thing may no longer fit
 * between the wall and the table beside it.
 */
export const resizeObject = defineCommand({
  name: 'resize-object',
  summary: 'Make a thing another size where it stands',
  args: z.object({
    room: z.string().min(1),
    type: z.enum(OBJECT_TYPE_IDS as [string, ...string[]]),
    /** Which one, when there are several: 1 for the first put in. Left out, the last. */
    nth: z.coerce.number().int().positive().optional(),
    width: length().optional(),
    depth: length().optional(),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'resize-object')
    const room = roomNamed(draft, level, args.room, 'resize-object')
    const found = objectNamed(draft, level, room, args.type, args.nth, 'resize-object')
    if (args.width === undefined && args.depth === undefined) {
      throw new CommandError('resize-object: say a --width or a --depth')
    }
    const label = objectType(found.type)?.label.toLowerCase() ?? found.type
    const size = { width: args.width ?? found.width, depth: args.depth ?? found.depth }

    const spot = {
      ...(found.against ? { against: found.against } : {}),
      along: found.along,
      ...(found.across !== undefined ? { across: found.across } : {}),
    }
    const problem = standingProblem(draft, level, room, spot, { ...found, ...size }, found.id)
    if (problem) {
      throw new CommandError(
        `resize-object: a ${size.width} by ${size.depth} mm ${label} does not fit where it stands in ${room.name}: ${problem}`,
      )
    }
    const target = draft.objects[found.id]!
    target.width = size.width
    target.depth = size.depth
  },
})
