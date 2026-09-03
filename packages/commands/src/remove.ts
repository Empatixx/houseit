import type { Opening } from '@houseit/core/document'
import { OBJECT_TYPE_IDS } from '@houseit/core/object-types'
import { z } from 'zod'
import { defineCommand } from './define-command'
import { openingRef } from './openings'
import { levelOf, SIDE_NAMES, thingNamed } from './resolve'

/**
 * Taking things back out again.
 *
 * A thing is named by its id from `describe`, or the way it was put in — by
 * room, by type, by side — and then the one that goes is the one that went in
 * last, which makes removing the undo of adding rather than a second way of
 * saying which.
 *
 * Ask for more than one and you ask more than once. Taking out every chair on one
 * word is the kind of help nobody wants from a drawing.
 */

export const removeObject = defineCommand({
  name: 'remove-object',
  summary: 'Take a thing back out of a room: by id, or the last one of its type, or the nth',
  args: z.object({
    /** Its id from describe; or say the room and type. */
    id: z.string().min(1).optional(),
    room: z.string().min(1).optional(),
    type: z.enum(OBJECT_TYPE_IDS as [string, ...string[]]).optional(),
    /** Which one, when there are several: 1 for the first put in. Left out, the last. */
    nth: z.coerce.number().int().positive().optional(),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'remove-object')
    const { object } = thingNamed(draft, level, args, 'remove-object')
    delete draft.objects[object.id]
  },
})

/** Windows and doors come out the same way; only the word differs. */
function removeOpening(kind: Opening['kind']) {
  const name = `remove-${kind}`
  return defineCommand({
    name,
    summary: `Take a ${kind} back out of a wall: by id, or the last on a side of a room, or the nth`,
    args: z.object({
      /** Its id from describe; or say the room and side it is in. */
      id: z.string().min(1).optional(),
      room: z.string().min(1).optional(),
      side: z.enum(SIDE_NAMES).optional(),
      wall: z.string().min(1).optional(),
      /** Which one, when there are several in that wall: 1 for the first put in. Left out, the last. */
      nth: z.coerce.number().int().positive().optional(),
      level: z.string().optional(),
    }),
    run: (draft, args) => {
      const level = levelOf(draft, args.level, name)
      const { opening } = openingRef(draft, level, args, kind, name)
      delete draft.openings[opening.id]
    },
  })
}

export const removeWindow = removeOpening('window')
export const removeDoor = removeOpening('door')
