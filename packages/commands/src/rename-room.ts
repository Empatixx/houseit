import { roomsOf } from '@houseit/geometry/rooms'
import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { levelOf, roomNamed } from './resolve'

/**
 * Gives a room another name. Names are how every command finds a room, so no
 * two rooms on a level may share one — the second "bedroom" is refused, and
 * has to be "bedroom 2".
 */
export const renameRoom = defineCommand({
  name: 'rename-room',
  summary: 'Call a room something else',
  args: z.object({
    room: z.string().min(1),
    name: z.string().trim().min(1),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'rename-room')
    const room = roomNamed(draft, level, args.room, 'rename-room')
    const taken = roomsOf(draft, level).some(
      (other) => other.id !== room.id && other.name === args.name,
    )
    if (taken) throw new CommandError(`rename-room: there is already a room called ${args.name}`)
    draft.rooms[room.id]!.name = args.name
  },
})
