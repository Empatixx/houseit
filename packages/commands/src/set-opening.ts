import type { Opening } from '@houseit/core/document'
import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { length } from './length-schema'
import { openingRef } from './openings'
import { checkOpeningAt } from './place-opening'
import { levelOf, type roomNamed, SIDE_NAMES } from './resolve'

/**
 * Changes a door or a window where it is: a wider window, a pocket door
 * instead of a hinged one. A new width has to fit the wall and its neighbours
 * as a new opening would, and a door that starts to swing has to be able to.
 * Named by id from `describe`, or by room, side and which one.
 */

const named = {
  /** Its id from describe; or say the room and side it is in. */
  id: z.string().min(1).optional(),
  room: z.string().min(1).optional(),
  side: z.enum(SIDE_NAMES).optional(),
  wall: z.string().min(1).optional(),
  /** Which one, when there are several in that wall. Left out, the last. */
  nth: z.coerce.number().int().positive().optional(),
}

export const setDoor = defineCommand({
  name: 'set-door',
  summary: 'Change a door where it is: its kind or its width',
  args: z.object({
    ...named,
    variant: z.enum(['hinged', 'sliding', 'pocket', 'garage']).optional(),
    width: length().optional(),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'set-door')
    const { opening, room } = openingRef(draft, level, args, 'door', 'set-door')
    if (args.variant === undefined && args.width === undefined) {
      throw new CommandError('set-door: say a --variant or a --width')
    }
    const variant = args.variant ?? opening.variant
    const width = args.width ?? opening.width
    refit(draft, level, room, opening, width, variant === 'hinged', 'set-door')
    const target = draft.openings[opening.id]!
    target.variant = variant
    target.width = width
  },
})

export const setWindow = defineCommand({
  name: 'set-window',
  summary: 'Change a window where it is: its width, height or sill',
  args: z.object({
    ...named,
    width: length().optional(),
    height: length().optional(),
    sill: length().optional(),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'set-window')
    const { opening, room } = openingRef(draft, level, args, 'window', 'set-window')
    if (args.width === undefined && args.height === undefined && args.sill === undefined) {
      throw new CommandError('set-window: say a --width, a --height or a --sill')
    }
    const width = args.width ?? opening.width
    refit(draft, level, room, opening, width, false, 'set-window')
    const target = draft.openings[opening.id]!
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
