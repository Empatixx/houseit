import { ROOM_KIND_IDS } from '@houseit/core/room-kinds'
import { z } from 'zod'
import { defineCommand } from './define-command'
import { levelOf, roomNamed } from './resolve'

/**
 * Says what sort of room a room is, when its name does not: "the snug" is a
 * living room. `check-plan` reads it for what the room is owed — a window, a
 * size, a hall between it and the kitchen.
 */
export const setRoomKind = defineCommand({
  name: 'set-room-kind',
  summary: `Say what sort of room a room is (${ROOM_KIND_IDS.join(', ')})`,
  args: z.object({
    room: z.string().min(1),
    kind: z.enum(ROOM_KIND_IDS as [string, ...string[]]),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'set-room-kind')
    const room = roomNamed(draft, level, args.room, 'set-room-kind')
    draft.rooms[room.id]!.kind = args.kind
  },
})
