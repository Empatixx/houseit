import { roomsOf } from '@houseit/geometry/rooms'
import { sideRun } from '@houseit/geometry/sides'
import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { deleteWall, straighten } from './graph'
import { length } from './length-schema'
import { wallInto } from './partition'
import { levelOf, roomNamed } from './resolve'
import { stubNamed } from './stubs'

export const removeWall = defineCommand({
  name: 'remove-wall',
  summary: 'Take out a wall stub hanging off one side of a room',
  args: z.object({
    room: z.string().min(1),
    side: z.enum(['north', 'south', 'east', 'west']),
    along: z.coerce.number().min(0).max(1),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'remove-wall')
    const room = roomNamed(draft, level, args.room, 'remove-wall')
    const stub = stubNamed(draft, level, room, args.side, args.along, 'remove-wall')
    deleteWall(draft, level, stub.wall.id)
    if (draft.nodes[stub.root]) straighten(draft, level, stub.root)
  },
})

export const resizeWall = defineCommand({
  name: 'resize-wall',
  summary: 'Make a wall stub another length; long enough, it reaches the far wall',
  args: z.object({
    room: z.string().min(1),
    side: z.enum(['north', 'south', 'east', 'west']),
    along: z.coerce.number().min(0).max(1),
    length: length(),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'resize-wall')
    const room = roomNamed(draft, level, args.room, 'resize-wall')
    const stub = stubNamed(draft, level, room, args.side, args.along, 'resize-wall')
    if (args.length <= 0) throw new CommandError('resize-wall: a stub has to have some length')

    const run = sideRun(draft, level, room, args.side)
    if (!run) throw new CommandError(`resize-wall: ${room.name} has no wall facing ${args.side}`)
    const root = draft.nodes[stub.root]!
    const from = { x: root.x, y: root.y }
    const thickness = stub.wall.thickness

    deleteWall(draft, level, stub.wall.id)
    const fresh = roomsOf(draft, level).find((candidate) => candidate.id === room.id)
    if (!fresh) throw new CommandError(`resize-wall: ${room.name} was lost`)
    wallInto(draft, level, fresh, from, run.inward, args.length, thickness, 'resize-wall')
  },
})
