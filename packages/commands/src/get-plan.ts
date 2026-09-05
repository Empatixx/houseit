import { roomsOf } from '@houseit/geometry/rooms'
import { z } from 'zod'
import { defineCommand } from './define-command'
import { levelOf, whereRoom } from './resolve'

/**
 * Reads the plan back. The only question there is.
 *
 * Every other command already answers with the rooms it touched, so this is for
 * the rooms it did not: what the whole plan looks like now, or one room of it in
 * particular. It changes nothing — it only says which rooms the answer should
 * cover, and the answer is put together the same way it is for a command that
 * did change something.
 *
 * That is why there is no `describe` and no `measure`. Asking and doing gave
 * two shapes of reply to learn and two places for them to drift apart; there is
 * one now, and it comes back whether it was asked for or not.
 */
export const getPlan = defineCommand({
  name: 'get-plan',
  summary:
    'Read the plan back: every room, or one of them, with what stands there and what is free',
  args: z.object({
    room: z.string().min(1).optional(),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    // A room named is looked for on every storey, so `--room ložnice` finds the
    // bedroom wherever it is; a storey named is the storey meant.
    if (args.room !== undefined) {
      return { shown: [whereRoom(draft, args.level, args.room, 'get-plan').room.id] }
    }
    const level = levelOf(draft, args.level, 'get-plan')
    return {
      shown: roomsOf(draft, level)
        .map((room) => room.id)
        .filter((id) => id !== undefined),
    }
  },
})
