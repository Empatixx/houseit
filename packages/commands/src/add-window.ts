import { z } from 'zod'
import { allocateId } from './allocate-id'
import { along, alongSide } from './along-schema'
import { defineCommand } from './define-command'
import { length } from './length-schema'
import { placeOpening, placeOpeningAt } from './place-opening'
import { levelOf, roomNamed, SIDE_NAMES, sideNamed } from './resolve'

const DEFAULT_WIDTH = 1200
const DEFAULT_HEIGHT = 1500
const DEFAULT_SILL = 900

/**
 * A window is placed by room and the wall it goes in — a compass side, or a
 * wall id from `describe`. Where along the wall it lands is `placeOpening`'s
 * decision unless `--along` says.
 */
export const addWindow = defineCommand({
  name: 'add-window',
  summary: 'Put a window in a wall of a room: on a side of it, or in a wall by id',
  args: z.object({
    room: z.string().min(1),
    /** The side of the room the window goes in; the longest wall facing that way, if there are several. */
    side: z.enum(SIDE_NAMES).optional(),
    /** Or the very wall, by its id from describe. */
    wall: z.string().min(1).optional(),
    width: length().default(DEFAULT_WIDTH),
    height: length().default(DEFAULT_HEIGHT),
    sill: length().default(DEFAULT_SILL),
    /** Exactly where along that wall: a fraction (0 west or south, 1 the other end) or a length from that end. Left out, the place is chosen. */
    along: along().optional(),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'add-window')
    const room = roomNamed(draft, level, args.room, 'add-window')
    const at = sideNamed(draft, level, room, args, 'add-window')

    const spot =
      args.along !== undefined
        ? placeOpeningAt(
            draft,
            level,
            room,
            at.side,
            args.width,
            alongSide(draft, level, room, at, args.along, 'add-window'),
            'add-window',
            false,
            undefined,
            at.nth,
          )
        : placeOpening(
            draft,
            level,
            room,
            at.side,
            args.width,
            'add-window',
            false,
            undefined,
            at.nth,
            at.wall,
          )
    const id = allocateId(draft.openings, 'o')
    draft.openings[id] = {
      id,
      wall: spot.wall,
      t: spot.t,
      kind: 'window',
      variant: 'hinged',
      width: args.width,
      height: args.height,
      sillHeight: args.sill,
      hinge: 'a',
      swing: 1,
    }
  },
})
