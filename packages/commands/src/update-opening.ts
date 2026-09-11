import type { HouseDocument, Opening } from '@houseit/core/document'
import { DOOR_VARIANTS, OpeningSchema } from '@houseit/core/document'
import { FrameSchema, PanelsSchema } from '@houseit/core/opening-assembly'
import type { Room } from '@houseit/geometry/rooms'
import type { Draft } from 'immer'
import { z } from 'zod'
import { along, alongSide } from './along-schema'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { json } from './json-schema'
import { length } from './length-schema'
import { openingById } from './openings'
import { checkOpeningAt, placeOpening, placeOpeningAt } from './place-opening'
import { SIDE_NAMES, sideNamed } from './resolve'

export const updateOpening = defineCommand({
  name: 'update-opening',
  summary: `Change a door or a window: its size, its kind of leaf (${DOOR_VARIANTS.join(', ')}), or where in the wall it sits`,
  args: z.object({
    id: z.string().min(1),
    panels: json(PanelsSchema).optional(),
    frame: json(FrameSchema).optional(),
    width: length().optional(),
    height: length().optional(),
    sill: length().optional(),
    variant: z.enum(['hinged', 'sliding', 'pocket', 'garage']).optional(),
    along: along().optional(),
    toSide: z.enum(SIDE_NAMES).optional(),
    toWall: z.string().min(1).optional(),
  }),
  run: (draft, args) => {
    const found = openingById(draft, args.id, 'update-opening')
    const { opening, room, level } = found
    const door = opening.kind === 'door'

    if (args.variant !== undefined && !door) {
      throw new CommandError('update-opening: a window has no leaf, so no --variant')
    }
    if (args.sill !== undefined && door) {
      throw new CommandError('update-opening: a door starts on the floor, so it has no --sill')
    }
    const moving =
      args.toSide !== undefined || args.toWall !== undefined || args.along !== undefined
    const resizing =
      args.width !== undefined || args.height !== undefined || args.sill !== undefined
    if (
      !moving &&
      !resizing &&
      args.variant === undefined &&
      args.panels === undefined &&
      args.frame === undefined
    ) {
      throw new CommandError(
        'update-opening: say what to change — --width, --height, --sill, --variant, --along, --to-side or --to-wall',
      )
    }

    const variant = args.variant ?? opening.variant
    const width = args.width ?? opening.width
    const swings = door && variant === 'hinged'

    if (moving) {
      const at =
        args.toSide !== undefined || args.toWall !== undefined
          ? sideNamed(
              draft,
              level,
              room,
              { side: args.toSide, wall: args.toWall },
              'update-opening',
            )
          : { side: found.side, nth: found.run }
      const spot =
        args.along !== undefined
          ? placeOpeningAt(
              draft,
              level,
              room,
              at.side,
              width,
              alongSide(draft, level, room, at, args.along, 'update-opening'),
              'update-opening',
              swings,
              opening.id,
              at.nth,
            )
          : placeOpening(
              draft,
              level,
              room,
              at.side,
              width,
              'update-opening',
              swings,
              opening.id,
              at.nth,
              at.wall,
            )
      const target = draft.openings[opening.id]!
      target.wall = spot.wall
      target.t = spot.t
      if (door) target.swing = spot.swing
    } else if (resizing || args.variant !== undefined) {
      refit(draft, level, room, opening, width, swings, 'update-opening')
    }

    const target = draft.openings[opening.id]!
    target.width = width
    target.variant = variant
    if (args.height !== undefined) target.height = args.height
    if (args.sill !== undefined) target.sillHeight = args.sill
    if (args.panels !== undefined) target.panels = args.panels
    if (args.frame !== undefined) target.frame = args.frame
    OpeningSchema.parse(target)
    return { changed: [opening.id] }
  },
})

function refit(
  draft: Draft<HouseDocument>,
  level: string,
  room: Room & { id: string },
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
