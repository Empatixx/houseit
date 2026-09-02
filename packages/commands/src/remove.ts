import type { Opening } from '@houseit/core/document'
import { OBJECT_TYPE_IDS } from '@houseit/core/object-types'
import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { wallsFacing } from './place-opening'
import { levelOf, newest, objectNamed, roomNamed } from './resolve'

/**
 * Taking things back out again.
 *
 * Nothing here identifies what to remove by id. An id is not something anybody
 * knows: what they know is that there is a rug in the living room and they want it
 * gone. So a thing is named the way it was put in — by room, by type, by side —
 * and the one that goes is the one that went in last, which makes removing the
 * undo of adding rather than a second way of saying which.
 *
 * Ask for more than one and you ask more than once. Taking out every chair on one
 * word is the kind of help nobody wants from a drawing.
 */

export const removeObject = defineCommand({
  name: 'remove-object',
  summary: 'Take a thing back out of a room: the last one of its type, or the nth',
  args: z.object({
    room: z.string().min(1),
    type: z.enum(OBJECT_TYPE_IDS as [string, ...string[]]),
    /** Which one, when there are several: 1 for the first put in. Left out, the last. */
    nth: z.coerce.number().int().positive().optional(),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'remove-object')
    const room = roomNamed(draft, level, args.room, 'remove-object')
    const found = objectNamed(draft, level, room, args.type, args.nth, 'remove-object')
    delete draft.objects[found.id]
  },
})

/** Windows and doors come out the same way; only the word differs. */
function removeOpening(kind: Opening['kind']) {
  const name = `remove-${kind}`
  return defineCommand({
    name,
    summary: `Take the last ${kind} back out of the wall on one side of a room`,
    args: z.object({
      room: z.string().min(1),
      side: z.enum(['north', 'south', 'east', 'west']),
      level: z.string().optional(),
    }),
    run: (draft, args) => {
      const level = levelOf(draft, args.level, name)
      const room = roomNamed(draft, level, args.room, name)
      const walls = new Set(
        wallsFacing(draft, level, room, args.side, name).map((it) => it.wall.id),
      )

      const found = newest(
        Object.values(draft.openings).filter(
          (opening) => opening.kind === kind && walls.has(opening.wall),
        ),
      )
      if (!found) {
        throw new CommandError(
          `${name}: there is no ${kind} in the ${args.side} wall of ${args.room}`,
        )
      }

      delete draft.openings[found.id]
    },
  })
}

export const removeWindow = removeOpening('window')
export const removeDoor = removeOpening('door')
