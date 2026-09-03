import { z } from 'zod'
import { allocateId } from './allocate-id'
import { along, alongSide } from './along-schema'
import { defineCommand } from './define-command'
import { length } from './length-schema'
import { placeOpening, placeOpeningAt } from './place-opening'
import { levelOf, roomNamed, SIDE_NAMES, sideNamed } from './resolve'

const DEFAULT_HEIGHT = 1970

/**
 * How wide each sort of door is unless told otherwise — the reference's defaults, in
 * millimetres: a hinged leaf at 36", two sliding panels at 60", a pocket leaf
 * at 32" and a garage door at 9 feet.
 */
const WIDTHS = { hinged: 800, sliding: 1520, pocket: 810, garage: 2740 } as const

/**
 * A door is placed the same way a window is — by room and the wall it goes
 * in, said as a compass side or as a wall id from `describe` — which covers
 * both cases without a second shape. The east side of the kitchen is the
 * partition it shares with the living room, so that is an internal door; the
 * south side of the house is an outside wall, so that is the front door.
 *
 * It swings into the room you named it from. That is the one thing a door needs
 * that a window does not, and the room is the only place the answer can come
 * from.
 */
export const addDoor = defineCommand({
  name: 'add-door',
  summary: 'Put a door in a wall of a room: on a side of it, or in a wall by id',
  args: z.object({
    room: z.string().min(1),
    /** The side of the room the door goes in; the longest wall facing that way, if there are several. */
    side: z.enum(SIDE_NAMES).optional(),
    /** Or the very wall, by its id from describe — the way to reach the second north wall of an L. */
    wall: z.string().min(1).optional(),
    /** Hinged unless said otherwise; sliding and pocket doors do not swing. */
    variant: z.enum(['hinged', 'sliding', 'pocket', 'garage']).default('hinged'),
    width: length().optional(),
    height: length().default(DEFAULT_HEIGHT),
    /** Exactly where along that wall: a fraction (0 west or south, 1 the other end) or a length from that end. Left out, the place is chosen. */
    along: along().optional(),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'add-door')
    const room = roomNamed(draft, level, args.room, 'add-door')
    const at = sideNamed(draft, level, room, args, 'add-door')

    const width = args.width ?? WIDTHS[args.variant]
    // Only a hinged leaf sweeps into the room; the rest stay in the wall's plane,
    // so nothing standing in front of them is in their way.
    const swings = args.variant === 'hinged'
    const spot =
      args.along !== undefined
        ? placeOpeningAt(
            draft,
            level,
            room,
            at.side,
            width,
            alongSide(draft, level, room, at.side, at.nth, args.along, 'add-door'),
            'add-door',
            swings,
            undefined,
            at.nth,
          )
        : placeOpening(draft, level, room, at.side, width, 'add-door', swings, undefined, at.nth)
    const id = allocateId(draft.openings, 'o')
    draft.openings[id] = {
      id,
      wall: spot.wall,
      t: spot.t,
      kind: 'door',
      variant: args.variant,
      width,
      height: args.height,
      sillHeight: 0,
      hinge: 'a',
      swing: spot.swing,
    }
  },
})
