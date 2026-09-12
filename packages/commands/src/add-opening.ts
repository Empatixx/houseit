import { DOOR_VARIANTS, OpeningSchema } from '@houseit/core/document'
import { FrameSchema, PanelsSchema } from '@houseit/core/opening-assembly'
import { roomsOf } from '@houseit/geometry/rooms'
import { wallElement } from '@houseit/geometry/wall-elements'
import { z } from 'zod'
import { allocateId } from './allocate-id'
import { along, alongSide, fractionOf } from './along-schema'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { json } from './json-schema'
import { length } from './length-schema'
import { directionAt, hasDoor, touchesWall } from './opening-direction'
import { checkFrame } from './opening-frame'
import { hingeAt } from './opening-hinge'
import { checkDoorLeaves, placeOpening, placeOpeningAt } from './place-opening'
import { checkPockets, setPocket } from './pocket-door'
import { levelOf, SIDE_NAMES, sideNamed, whereRoom } from './resolve'

import { validateWalls } from './wall'

const DOOR_HEIGHT = 1970
const WINDOW = { width: 1200, height: 1500, sill: 900 }

const DOOR_WIDTHS = { hinged: 800, sliding: 1520, pocket: 810, garage: 2740 } as const

export const openingWidth = (
  kind: 'door' | 'window' | 'assembly',
  variant?: keyof typeof DOOR_WIDTHS,
) => (kind === 'window' ? WINDOW.width : DOOR_WIDTHS[variant ?? 'hinged'])

export const addOpening = defineCommand({
  name: 'add-opening',
  summary: `For pocket doors, --slide-towards north|south|east|west chooses the wall pocket; omitted, a free side is chosen. Put a door, window or assembly in a wall. An assembly needs --panels JSON [{kind:fixed|casement|tilt-turn|opaque|door,x,z,width,height,glazing?:clear|frosted|none}] and --frame JSON {depth,face,inset?,outside,inside}, dimensions in mm and colours #rrggbb. Optional frame inset is measured inward from the outer structural wall face, before facade layers; a floor-level frame includes its clear recess in room area. A door panel with glazing:none has a solid leaf. --sill sets its height above the wall base (the floor when wall base is zero). Place it on a room side or directly with --wall and no room. Direct placement uses --along from the wall start (default midpoint), and --towards left|right controls swing (default left). --hinge left|right is viewed from the side it opens towards, facing the closed door. --opens-into names the room receiving the leaf, or outside. For paired hinged doors --leaf-width sets the main leaf width within --width; --hinge belongs to that main leaf. Door variants: ${DOOR_VARIANTS.join(', ')}`,
  args: z.object({
    room: z.string().min(1).optional(),
    towards: z.enum(['left', 'right']).optional(),
    kind: z.enum(['door', 'window', 'assembly']),
    panels: json(PanelsSchema).optional(),
    frame: json(FrameSchema).optional(),
    side: z.enum(SIDE_NAMES).optional(),
    wall: z.string().min(1).optional(),
    variant: z.enum(DOOR_VARIANTS).default('hinged'),
    hinge: z.enum(['left', 'right']).optional(),
    opensInto: z.string().min(1).optional(),
    slideTowards: z.enum(SIDE_NAMES).optional(),
    width: length().optional(),
    leafWidth: length().optional(),
    height: length().optional(),
    sill: length().optional(),
    along: along().optional(),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const context =
      args.room === undefined ? undefined : whereRoom(draft, args.level, args.room, 'add-opening')
    if (!context && !args.wall) throw new CommandError('add-opening: provide --room or --wall')
    if (!context && args.side) throw new CommandError('add-opening: --side needs --room')
    if (context && args.towards)
      throw new CommandError('add-opening: --towards belongs to direct wall placement')
    if (args.towards && args.opensInto)
      throw new CommandError('add-opening: use --towards or --opens-into')
    const element = context ? undefined : wallElement(draft, args.wall!)
    const level = context?.level ?? element!.level
    if (args.level && levelOf(draft, args.level, 'add-opening') !== level)
      throw new CommandError('add-opening: wall belongs to another storey')
    const room = context?.room
    const at = room ? sideNamed(draft, level, room, args, 'add-opening') : undefined
    const door = args.kind === 'door'
    if (
      args.kind === 'assembly' &&
      (args.width === undefined || args.height === undefined || !args.panels || !args.frame)
    )
      throw new CommandError('add-opening: assembly needs --width, --height, --panels and --frame')

    const width = args.width ?? (door ? DOOR_WIDTHS[args.variant] : WINDOW.width)
    const height = args.height ?? (door ? DOOR_HEIGHT : WINDOW.height)
    const sill = door ? 0 : (args.sill ?? (args.kind === 'assembly' ? 0 : WINDOW.sill))
    const swings =
      door &&
      args.variant === 'hinged' &&
      args.leafWidth === undefined &&
      args.frame?.inset === undefined
    const leaf = hasDoor(args) && args.variant === 'hinged'
    if (args.opensInto !== undefined && !leaf)
      throw new CommandError('add-opening: --opens-into needs a hinged door or a door panel')
    if (args.towards !== undefined && !leaf)
      throw new CommandError('add-opening: --towards needs a hinged door')
    if (args.hinge !== undefined && !leaf)
      throw new CommandError('add-opening: --hinge needs a hinged door')

    const spot =
      room && at
        ? args.along !== undefined
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
              args.opensInto,
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
              args.opensInto,
            )
        : (() => {
            const run = element!
            const distance =
              fractionOf(args.along ?? { fraction: 0.5 }, run, 'add-opening') * run.length
            const segment = run.segments.find(
              (s) => distance - width / 2 >= s.from && distance + width / 2 <= s.to,
            )
            if (!segment)
              throw new CommandError('add-opening: the opening must fit between wall junctions')
            let swing: 1 | -1 = args.towards === 'right' ? -1 : 1
            if (args.opensInto) {
              const adjacent = roomsOf(draft, level).find((r) => touchesWall(r, segment.wall))
              if (!adjacent)
                throw new CommandError(
                  'add-opening: --opens-into needs a room beside the wall; use --towards left|right',
                )
              swing = directionAt(
                draft,
                level,
                segment.wall.id,
                adjacent,
                args.opensInto,
                'add-opening',
              )
            }
            return {
              wall: segment.wall.id,
              t: (distance - segment.from) / (segment.to - segment.from),
              swing,
            }
          })()
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
      leafWidth: args.leafWidth,
      height,
      sillHeight: sill,
      hinge: args.hinge === undefined ? 'a' : hingeAt(spot.swing, args.hinge),
      swing: door || args.kind === 'assembly' ? spot.swing : 1,
    })
    checkFrame(draft, draft.openings[id]!, 'add-opening')
    const beside =
      room ?? roomsOf(draft, level).find((r) => touchesWall(r, draft.walls[spot.wall]!))
    if (beside) checkDoorLeaves(draft, level, beside, draft.openings[id]!, 'add-opening')
    setPocket(draft, draft.openings[id]!, args.slideTowards, 'add-opening')
    checkPockets(draft, level, 'add-opening')
    if (!room) validateWalls(draft, level)
    return { changed: [id], at: level }
  },
})
