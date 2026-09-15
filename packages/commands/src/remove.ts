import { roomsOf } from '@houseit/geometry/rooms'
import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { roomOfOpening } from './openings'
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
    const opening = draft.openings[args.id]
    if (!opening)
      throw new CommandError(`remove-opening: there is no door or window called ${args.id}`)
    const wall = draft.walls[opening.wall]!
    const room = roomOfOpening(draft, roomsOf(draft, wall.level), opening)
    delete draft.openings[opening.id]
    return {
      changed: [opening.id, wall.element ?? wall.id, ...(room?.id ? [room.id] : [])],
      at: wall.level,
    }
  },
})
