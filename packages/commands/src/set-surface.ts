import { OBJECT_TYPE_IDS, objectType } from '@houseit/core/object-types'
import { SURFACE_IDS } from '@houseit/core/surfaces'
import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { levelOf, objectNamed, roomNamed } from './resolve'

/**
 * Gives a thing another finish: the same bed in linen instead of white. Only
 * the finishes its type comes in, so a fridge does not come in oak.
 */
export const setSurface = defineCommand({
  name: 'set-surface',
  summary: 'Give a thing another finish',
  args: z.object({
    room: z.string().min(1),
    type: z.enum(OBJECT_TYPE_IDS as [string, ...string[]]),
    /** Which one, when there are several: 1 for the first put in. Left out, the last. */
    nth: z.coerce.number().int().positive().optional(),
    surface: z.enum(SURFACE_IDS as [string, ...string[]]),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'set-surface')
    const room = roomNamed(draft, level, args.room, 'set-surface')
    const found = objectNamed(draft, level, room, args.type, args.nth, 'set-surface')
    const type = objectType(found.type)
    if (type && !type.surfaces.includes(args.surface)) {
      throw new CommandError(
        `set-surface: a ${type.label.toLowerCase()} does not come in ${args.surface} — only ${type.surfaces.join(', ')}`,
      )
    }
    draft.objects[found.id]!.surface = args.surface
  },
})
