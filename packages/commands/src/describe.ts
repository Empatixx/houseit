import { z } from 'zod'
import { defineCommand } from './define-command'
import { levelOf, roomNamed } from './resolve'
import { surveyLevel, surveyRoom } from './survey'

/**
 * Says what is there.
 *
 * The plan as a whole, or one room of it: how big, what floor, which rooms are
 * next door, where the doors and windows are, what stands in it and where. It
 * changes nothing and answers with data, so an agent that made the plan can read
 * it back in the words its own commands use — and so can one that did not.
 */
export const describe = defineCommand({
  name: 'describe',
  summary:
    'Say what is in the plan, or in one room: size, floor, neighbours, doors, windows, what stands there',
  args: z.object({
    room: z.string().min(1).optional(),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'describe')
    if (args.room === undefined) return surveyLevel(draft, level)
    return surveyRoom(draft, level, roomNamed(draft, level, args.room, 'describe'))
  },
})
