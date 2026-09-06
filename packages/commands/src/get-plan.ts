import { roomsOf } from '@houseit/geometry/rooms'
import { z } from 'zod'
import { defineCommand } from './define-command'
import { levelOf, whereRoom } from './resolve'

export const getPlan = defineCommand({
  name: 'get-plan',
  summary:
    'Read the plan back: every room, or one of them, with what stands there and what is free',
  args: z.object({
    room: z.string().min(1).optional(),
    level: z.string().optional(),
  }),
  run: (draft, args, open) => {
    if (args.room !== undefined) {
      const { room, level } = whereRoom(draft, args.level, args.room, 'get-plan')
      return { shown: [room.id], at: level }
    }
    const level = levelOf(draft, args.level ?? open, 'get-plan')
    return {
      at: level,
      shown: roomsOf(draft, level)
        .map((room) => room.id)
        .filter((id) => id !== undefined),
    }
  },
})
