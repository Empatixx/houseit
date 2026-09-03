import type { Opening } from '@houseit/core/document'
import { z } from 'zod'
import { along, alongSide } from './along-schema'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { openingRef } from './openings'
import { placeOpening, placeOpeningAt } from './place-opening'
import { levelOf, SIDE_NAMES, sideNamed } from './resolve'

/**
 * Moves a door or a window: along the wall it is in, or to another wall of
 * its room. Named by its id from `describe`, or the way it was put in — room,
 * side, and which one when there are several — and put down the way a new
 * one would be: at the place said with `--along`, or the middle of the free
 * stretch when only the wall is. Checked the same way too, so a door cannot
 * be dragged onto a window or to where the wardrobe would stop it opening.
 */
function moveOpening(kind: Opening['kind']) {
  const name = `move-${kind}`
  return defineCommand({
    name,
    summary: `Move a ${kind} along its wall, or to another wall of its room`,
    args: z.object({
      /** Its id from describe; or say the room and side it is in. */
      id: z.string().min(1).optional(),
      room: z.string().min(1).optional(),
      side: z.enum(SIDE_NAMES).optional(),
      wall: z.string().min(1).optional(),
      /** Which one, when there are several in that wall: 1 for the first put in. Left out, the last. */
      nth: z.coerce.number().int().positive().optional(),
      /** Another side of the room to move it to, or another wall by id. Left out, it stays in its wall. */
      toSide: z.enum(SIDE_NAMES).optional(),
      toWall: z.string().min(1).optional(),
      /** How far along that wall: a fraction, or a length from the west or south end. Left out, the place is chosen. */
      along: along().optional(),
      level: z.string().optional(),
    }),
    run: (draft, args) => {
      const level = levelOf(draft, args.level, name)
      const found = openingRef(draft, level, args, kind, name)
      if (args.toSide === undefined && args.toWall === undefined && args.along === undefined) {
        throw new CommandError(`${name}: say where to — --to-side, --to-wall or --along`)
      }

      const at =
        args.toSide !== undefined || args.toWall !== undefined
          ? sideNamed(draft, level, found.room, { side: args.toSide, wall: args.toWall }, name)
          : { side: found.side, nth: found.run }
      const { opening, room } = found
      const swings = kind === 'door' && opening.variant === 'hinged'
      const spot =
        args.along !== undefined
          ? placeOpeningAt(
              draft,
              level,
              room,
              at.side,
              opening.width,
              alongSide(draft, level, room, at, args.along, name),
              name,
              swings,
              opening.id,
              at.nth,
            )
          : placeOpening(
              draft,
              level,
              room,
              at.side,
              opening.width,
              name,
              swings,
              opening.id,
              at.nth,
              at.wall,
            )

      const target = draft.openings[opening.id]!
      target.wall = spot.wall
      target.t = spot.t
      if (kind === 'door') target.swing = spot.swing
    },
  })
}

export const moveDoor = moveOpening('door')
export const moveWindow = moveOpening('window')
