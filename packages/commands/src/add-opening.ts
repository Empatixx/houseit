import { z } from 'zod'
import { allocateId } from './allocate-id'
import { along, alongSide } from './along-schema'
import { defineCommand } from './define-command'
import { length } from './length-schema'
import { placeOpening, placeOpeningAt } from './place-opening'
import { SIDE_NAMES, sideNamed, whereRoom } from './resolve'

const DOOR_HEIGHT = 1970
const WINDOW = { width: 1200, height: 1500, sill: 900 }

/**
 * How wide each sort of door is unless told otherwise — the reference's defaults, in
 * millimetres: a hinged leaf at 36", two sliding panels at 60", a pocket leaf
 * at 32" and a garage door at 9 feet.
 */
const DOOR_WIDTHS = { hinged: 800, sliding: 1520, pocket: 810, garage: 2740 } as const

/**
 * Puts a door or a window in a wall.
 *
 * One command for both, because they are one thing: a hole in a wall, placed by
 * the room it is reached from and the wall it goes in — said as a compass side,
 * or as a wall id from the answer to the last command. The east side of the
 * kitchen is the partition it shares with the living room, so that is an
 * internal door; the south side of the house is an outside wall, so that is the
 * front door.
 *
 * What differs is only the sill and the swing. A door swings into the room you
 * named it from, which is the one thing a door needs that a window does not,
 * and the room is the only place the answer can come from.
 */
export const addOpening = defineCommand({
  name: 'add-opening',
  summary: 'Put a door or a window in a wall of a room: on a side of it, or in a wall by id',
  args: z.object({
    room: z.string().min(1),
    kind: z.enum(['door', 'window']),
    /** The side of the room it goes in; the longest wall facing that way, if there are several. */
    side: z.enum(SIDE_NAMES).optional(),
    /** Or the very wall by its id — the way to reach the second north wall of an L. */
    wall: z.string().min(1).optional(),
    /** A door's leaf: hinged unless said otherwise. Sliding and pocket doors do not swing. */
    variant: z.enum(['hinged', 'sliding', 'pocket', 'garage']).default('hinged'),
    width: length().optional(),
    height: length().optional(),
    /** How high off the floor a window starts. Nothing to a door, which starts on it. */
    sill: length().optional(),
    /** Exactly where along that wall: a fraction (0 west or south, 1 the other end) or a length from that end. Left out, the place is chosen. */
    along: along().optional(),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const { room, level } = whereRoom(draft, args.level, args.room, 'add-opening')
    const at = sideNamed(draft, level, room, args, 'add-opening')
    const door = args.kind === 'door'

    const width = args.width ?? (door ? DOOR_WIDTHS[args.variant] : WINDOW.width)
    const height = args.height ?? (door ? DOOR_HEIGHT : WINDOW.height)
    const sill = door ? 0 : (args.sill ?? WINDOW.sill)
    // Only a hinged leaf sweeps into the room; the rest stay in the wall's plane,
    // so nothing standing in front of them is in their way.
    const swings = door && args.variant === 'hinged'

    const spot =
      args.along !== undefined
        ? placeOpeningAt(
            draft,
            level,
            room,
            at.side,
            width,
            alongSide(draft, level, room, at, args.along, 'add-opening'),
            'add-opening',
            swings,
            undefined,
            at.nth,
          )
        : placeOpening(
            draft,
            level,
            room,
            at.side,
            width,
            'add-opening',
            swings,
            undefined,
            at.nth,
            at.wall,
          )

    const id = allocateId(draft.openings, 'o')
    draft.openings[id] = {
      id,
      wall: spot.wall,
      t: spot.t,
      kind: args.kind,
      variant: door ? args.variant : 'hinged',
      width,
      height,
      sillHeight: sill,
      hinge: 'a',
      swing: door ? spot.swing : 1,
    }
    return { changed: [id] }
  },
})
