import { z } from 'zod'
import { defineCommand } from './define-command'
import { openingById } from './openings'
import { thingById } from './resolve'

export const removeObject = defineCommand({
  name: 'remove-object',
  summary: 'Take a thing back out of a room',
  args: z.object({
    id: z.string().min(1),
  }),
  run: (draft, args) => {
    const { object, room } = thingById(draft, args.id, 'remove-object')
    delete draft.objects[object.id]
    return { changed: [object.id, room.id] }
  },
})

export const removeOpening = defineCommand({
  name: 'remove-opening',
  summary: 'Take a door or a window back out of a wall',
  args: z.object({
    id: z.string().min(1),
  }),
  run: (draft, args) => {
    const { opening, room } = openingById(draft, args.id, 'remove-opening')
    delete draft.openings[opening.id]
    return { changed: [opening.id, room.id] }
  },
})
