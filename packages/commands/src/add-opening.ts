import { DOOR_VARIANTS, OpeningSchema } from '@houseit/core/document'
import { FrameSchema, PanelsSchema } from '@houseit/core/opening-assembly'
import { z } from 'zod'
import { allocateId } from './allocate-id'
import { along, alongSide } from './along-schema'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { json } from './json-schema'
import { length } from './length-schema'
import { placeOpening, placeOpeningAt } from './place-opening'
import { SIDE_NAMES, sideNamed, whereRoom } from './resolve'

const DOOR_HEIGHT = 1970
const WINDOW = { width: 1200, height: 1500, sill: 900 }

const DOOR_WIDTHS = { hinged: 800, sliding: 1520, pocket: 810, garage: 2740 } as const

export const openingWidth = (
  kind: 'door' | 'window' | 'assembly',
  variant?: keyof typeof DOOR_WIDTHS,
) => (kind === 'window' ? WINDOW.width : DOOR_WIDTHS[variant ?? 'hinged'])

export const addOpening = defineCommand({
  name: 'add-opening',
  summary: `Put a door, window or assembly in a wall. An assembly needs --panels JSON [{kind:fixed|door,x,z,width,height}] and --frame JSON {depth,face,outside,inside}, dimensions in mm and colours #rrggbb. Place it: on a side of it, or in a wall by id — a door with a leaf that is ${DOOR_VARIANTS.join(', ')}`,
  args: z.object({
    room: z.string().min(1),
    kind: z.enum(['door', 'window', 'assembly']),
    panels: json(PanelsSchema).optional(),
    frame: json(FrameSchema).optional(),
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
    if (
      args.kind === 'assembly' &&
      (args.width === undefined || args.height === undefined || !args.panels || !args.frame)
    )
      throw new CommandError('add-opening: assembly needs --width, --height, --panels and --frame')

    const width = args.width ?? (door ? DOOR_WIDTHS[args.variant] : WINDOW.width)
    const height = args.height ?? (door ? DOOR_HEIGHT : WINDOW.height)
    const sill = door || args.kind === 'assembly' ? 0 : (args.sill ?? WINDOW.sill)
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
    draft.openings[id] = OpeningSchema.parse({
      panels: args.panels,
      frame: args.frame,
      id,
      wall: spot.wall,
      t: spot.t,
      kind: args.kind,
      variant: door ? args.variant : 'hinged',
      width,
      height,
      sillHeight: sill,
      hinge: 'a',
      swing: door || args.kind === 'assembly' ? spot.swing : 1,
    })
    return { changed: [id] }
  },
})
