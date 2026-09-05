import { z } from 'zod'
import { defineCommand } from './define-command'
import { openingById } from './openings'
import { levelOf, thingById } from './resolve'

/**
 * Taking things back out again.
 *
 * By id, which is what the answer to putting it in said. Ask for more than one
 * and you ask more than once: taking out every chair on one word is the kind of
 * help nobody wants from a drawing.
 *
 * What comes back names both what went and the room it went from — the id is
 * gone from the plan, so the room is the only thing left to look at.
 */

export const removeObject = defineCommand({
  name: 'remove-object',
  summary: 'Take a thing back out of a room',
  args: z.object({
    /** Its id, as the last answer gave it. */
    id: z.string().min(1),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'remove-object')
    const { object, room } = thingById(draft, level, args.id, 'remove-object')
    delete draft.objects[object.id]
    return { changed: [object.id, room.id] }
  },
})

export const removeOpening = defineCommand({
  name: 'remove-opening',
  summary: 'Take a door or a window back out of a wall',
  args: z.object({
    /** Its id, as the last answer gave it. */
    id: z.string().min(1),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'remove-opening')
    const { opening, room } = openingById(draft, level, args.id, 'remove-opening')
    delete draft.openings[opening.id]
    return { changed: [opening.id, room.id] }
  },
})
