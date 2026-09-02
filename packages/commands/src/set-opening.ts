import type { Opening } from '@houseit/core/document'
import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { length } from './length-schema'
import { openingNamed } from './openings'
import { checkOpeningAt } from './place-opening'
import { levelOf, roomNamed } from './resolve'

/**
 * Changes a door or a window where it is: a wider window, a pocket door
 * instead of a hinged one. A new width has to fit the wall and its neighbours
 * as a new opening would, and a door that starts to swing has to be able to.
 */

export const setDoor = defineCommand({
  name: 'set-door',
  summary: 'Change a door where it is: its kind or its width',
  args: z.object({
    room: z.string().min(1),
    side: z.enum(['north', 'south', 'east', 'west']),
    /** Which one, when there are several in that wall. Left out, the last. */
    nth: z.coerce.number().int().positive().optional(),
    variant: z.enum(['hinged', 'sliding', 'pocket', 'garage']).optional(),
    width: length().optional(),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'set-door')
    const room = roomNamed(draft, level, args.room, 'set-door')
    const found = openingNamed(draft, level, room, 'door', args.side, args.nth, 'set-door')
    if (args.variant === undefined && args.width === undefined) {
      throw new CommandError('set-door: say a --variant or a --width')
    }
    const variant = args.variant ?? found.variant
    const width = args.width ?? found.width
    refit(draft, level, room, found, width, variant === 'hinged', 'set-door')
    const target = draft.openings[found.id]!
    target.variant = variant
    target.width = width
  },
})

export const setWindow = defineCommand({
  name: 'set-window',
  summary: 'Change a window where it is: its width, height or sill',
  args: z.object({
    room: z.string().min(1),
    side: z.enum(['north', 'south', 'east', 'west']),
    nth: z.coerce.number().int().positive().optional(),
    width: length().optional(),
    height: length().optional(),
    sill: length().optional(),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'set-window')
    const room = roomNamed(draft, level, args.room, 'set-window')
    const found = openingNamed(draft, level, room, 'window', args.side, args.nth, 'set-window')
    if (args.width === undefined && args.height === undefined && args.sill === undefined) {
      throw new CommandError('set-window: say a --width, a --height or a --sill')
    }
    const width = args.width ?? found.width
    refit(draft, level, room, found, width, false, 'set-window')
    const target = draft.openings[found.id]!
    target.width = width
    if (args.height !== undefined) target.height = args.height
    if (args.sill !== undefined) target.sillHeight = args.sill
  },
})

/** The opening at its own place, at the new width: still in the wall, clear of the rest. */
function refit(
  draft: Parameters<typeof checkOpeningAt>[0],
  level: string,
  room: ReturnType<typeof roomNamed>,
  found: Opening,
  width: number,
  swings: boolean,
  what: string,
) {
  const wall = draft.walls[found.wall]
  const a = wall && draft.nodes[wall.a]
  const b = wall && draft.nodes[wall.b]
  if (!wall || !a || !b) throw new CommandError(`${what}: the wall it is in is gone`)
  const span = Math.hypot(b.x - a.x, b.y - a.y)
  checkOpeningAt(draft, level, room, found.wall, found.t * span, width, what, swings, found.id)
}
