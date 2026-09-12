import { wallElement } from '@houseit/geometry/wall-elements'
import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { length } from './length-schema'
import { nearWall } from './partition'
import { levelOf, roomNamed } from './resolve'
import { stubNamed } from './stubs'
import { removeWall as removeElement, updateWall } from './wall'

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
    return removeElement.apply(draft, { id: stub.wall.element ?? stub.wall.id })
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

    const element = wallElement(draft, stub.wall.id)
    const end = element.from.id === stub.tip ? 'from' : 'to'
    const root = draft.nodes[stub.root]!
    const direction = end === 'to' ? 1 : -1
    const to = {
      x: root.x + direction * element.unit.x * args.length,
      y: root.y + direction * element.unit.y * args.length,
    }
    const snapped = nearWall(draft, level, to)
    const target =
      snapped &&
      Math.abs((snapped.x - root.x) * element.unit.y - (snapped.y - root.y) * element.unit.x) < 1
        ? Math.hypot(snapped.x - root.x, snapped.y - root.y)
        : args.length
    return updateWall.apply(draft, { id: element.id, length: target, end })
  },
})
