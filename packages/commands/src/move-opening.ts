import type { Opening } from '@houseit/core/document'
import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { openingNamed } from './openings'
import { placeOpening, placeOpeningAt } from './place-opening'
import { levelOf, roomNamed } from './resolve'

/**
 * Moves a door or a window: along the wall it is in, or to another side of
 * its room. Named the way it was put in — room, side, and which one when
 * there are several — and put down the way a new one would be: at the place
 * said with `--along`, or the middle of the free stretch when only the side
 * is. Checked the same way too, so a door cannot be dragged onto a window or
 * to where the wardrobe would stop it opening.
 */
function moveOpening(kind: Opening['kind']) {
  const name = `move-${kind}`
  return defineCommand({
    name,
    summary: `Move a ${kind} along its wall, or to another side of its room`,
    args: z.object({
      room: z.string().min(1),
      side: z.enum(['north', 'south', 'east', 'west']),
      /** Which one, when there are several in that wall: 1 for the first put in. Left out, the last. */
      nth: z.coerce.number().int().positive().optional(),
      /** Another side of the room to move it to. Left out, it stays in its wall. */
      toSide: z.enum(['north', 'south', 'east', 'west']).optional(),
      /** How far along that side, 0 west or south and 1 the other end. Left out, the place is chosen. */
      along: z.coerce.number().min(0).max(1).optional(),
      level: z.string().optional(),
    }),
    run: (draft, args) => {
      const level = levelOf(draft, args.level, name)
      const room = roomNamed(draft, level, args.room, name)
      const found = openingNamed(draft, level, room, kind, args.side, args.nth, name)
      if (args.toSide === undefined && args.along === undefined) {
        throw new CommandError(`${name}: say where to — --to-side or --along`)
      }

      const side = args.toSide ?? args.side
      const swings = kind === 'door' && found.variant === 'hinged'
      const spot =
        args.along !== undefined
          ? placeOpeningAt(
              draft,
              level,
              room,
              side,
              found.width,
              args.along,
              name,
              swings,
              found.id,
            )
          : placeOpening(draft, level, room, side, found.width, name, swings, found.id)

      const target = draft.openings[found.id]!
      target.wall = spot.wall
      target.t = spot.t
      if (kind === 'door') target.swing = spot.swing
    },
  })
}

export const moveDoor = moveOpening('door')
export const moveWindow = moveOpening('window')
