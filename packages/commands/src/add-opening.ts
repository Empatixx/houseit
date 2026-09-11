import { DOOR_VARIANTS } from '@houseit/core/document'
import { z } from 'zod'
import { allocateId } from './allocate-id'
import { along, alongSide } from './along-schema'
import { defineCommand } from './define-command'
import { length } from './length-schema'
import { placeOpening, placeOpeningAt } from './place-opening'
import { SIDE_NAMES, sideNamed, whereRoom } from './resolve'

const DOOR_HEIGHT = 1970
const WINDOW = { width: 1200, height: 1500, sill: 900 }

const DOOR_WIDTHS = { hinged: 800, sliding: 1520, pocket: 810, garage: 2740 } as const

export const openingWidth = (kind: 'door' | 'window', variant?: keyof typeof DOOR_WIDTHS) =>
  kind === 'window' ? WINDOW.width : DOOR_WIDTHS[variant ?? 'hinged']

export const addOpening = defineCommand({
  name: 'add-opening',
  summary: `Put a door or a window in a wall of a room: on a side of it, or in a wall by id — a door with a leaf that is ${DOOR_VARIANTS.join(', ')}`,
  args: z.object({
    room: z.string().min(1),
    kind: z.enum(['door', 'window']),
    side: z.enum(SIDE_NAMES).optional(),
    wall: z.string().min(1).optional(),
    variant: z.enum(DOOR_VARIANTS).default('hinged'),
    width: length().optional(),
    height: length().optional(),
    sill: length().optional(),
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
