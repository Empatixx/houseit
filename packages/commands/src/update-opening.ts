import type { HouseDocument, Opening } from '@houseit/core/document'
import { DOOR_VARIANTS, OpeningSchema } from '@houseit/core/document'
import { FrameSchema, PanelsSchema } from '@houseit/core/opening-assembly'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import type { Draft } from 'immer'
import { z } from 'zod'
import { along, alongSide } from './along-schema'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { json } from './json-schema'
import { length } from './length-schema'
import { hasDoor, opensIntoOf } from './opening-direction'
import { handOf, hingeAt } from './opening-hinge'
import { openingById } from './openings'
import { checkAssemblyDoors, checkOpeningAt, placeOpening, placeOpeningAt } from './place-opening'
import { SIDE_NAMES, sideNamed } from './resolve'

export const updateOpening = defineCommand({
  name: 'update-opening',
  summary: `Change a door or a window: its size, its kind of leaf (${DOOR_VARIANTS.join(', ')}), or where in the wall it sits. --hinge left|right is viewed from the side it opens towards, facing the closed door. --opens-into names the room receiving the leaf, or outside`,
  args: z.object({
    id: z.string().min(1),
    panels: json(PanelsSchema).optional(),
    frame: json(FrameSchema).optional(),
    width: length().optional(),
    height: length().optional(),
    sill: length().optional(),
    variant: z.enum(['hinged', 'sliding', 'pocket', 'garage']).optional(),
    hinge: z.enum(['left', 'right']).optional(),
    opensInto: z.string().min(1).optional(),
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
      args.hinge === undefined &&
      args.opensInto === undefined &&
      args.panels === undefined &&
      args.frame === undefined
    ) {
      throw new CommandError(
        'update-opening: say what to change — --width, --height, --sill, --variant, --hinge, --opens-into, --along, --to-side or --to-wall',
      )
    }

    const variant = args.variant ?? opening.variant
    const width = args.width ?? opening.width
    const swings = door && variant === 'hinged'
    const leaf =
      hasDoor({ kind: opening.kind, panels: args.panels ?? opening.panels }) && variant === 'hinged'
    if (args.opensInto !== undefined && !leaf)
      throw new CommandError('update-opening: --opens-into needs a hinged door or a door panel')
    if (args.hinge !== undefined && !leaf)
      throw new CommandError('update-opening: --hinge needs a hinged door')
    const hand = args.hinge ?? handOf(opening)
    const into =
      args.opensInto ?? (leaf ? opensIntoOf(draft, roomsOf(draft, level), opening) : undefined)

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
              into,
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
              into,
            )
      const target = draft.openings[opening.id]!
      target.wall = spot.wall
      target.t = spot.t
      if (leaf) target.swing = spot.swing
    } else if (resizing || args.variant !== undefined || args.opensInto !== undefined) {
      const swing = refit(draft, level, room, opening, width, swings, 'update-opening', into)
      if (leaf) draft.openings[opening.id]!.swing = swing
    }

    const target = draft.openings[opening.id]!
    target.width = width
    target.variant = variant
    if (leaf && (moving || args.hinge !== undefined)) target.hinge = hingeAt(target.swing, hand)
    if (args.height !== undefined) target.height = args.height
    if (args.sill !== undefined) target.sillHeight = args.sill
    if (args.panels !== undefined) target.panels = args.panels
    if (args.frame !== undefined) target.frame = args.frame
    OpeningSchema.parse(target)
    checkAssemblyDoors(draft, level, room, target, 'update-opening')
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
  into?: string,
) {
  const wall = draft.walls[found.wall]
  const a = wall && draft.nodes[wall.a]
  const b = wall && draft.nodes[wall.b]
  if (!wall || !a || !b) throw new CommandError(`${what}: the wall it is in is gone`)
  const span = Math.hypot(b.x - a.x, b.y - a.y)
  return checkOpeningAt(
    draft,
    level,
    room,
    found.wall,
    found.t * span,
    width,
    what,
    swings,
    found.id,
    into,
  )
}
