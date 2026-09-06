import { layerOf, OBJECT_TYPE_IDS, objectType } from '@houseit/core/object-types'
import { stairKind, stairShape } from '@houseit/core/stairs'
import { SURFACE_IDS } from '@houseit/core/surfaces'
import { sideRun } from '@houseit/geometry/sides'
import { z } from 'zod'
import { allocateId } from './allocate-id'
import { along, alongSide, fractionAcross, fractionOf, windowOf } from './along-schema'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { length } from './length-schema'
import { freeWidth, placeAgainst, placeFree, placeSomewhereAgainst } from './place-object'
import { SIDE_NAMES, sideNamed, whereRoom } from './resolve'
import { canStand, standingProblem, takenBy } from './standing-check'

export const addObject = defineCommand({
  name: 'add-object',
  summary: `Put something in a room (${OBJECT_TYPE_IDS.join(', ')})`,
  args: z.object({
    room: z.string().min(1),
    type: z.enum(OBJECT_TYPE_IDS as [string, ...string[]]),
    against: z.enum(SIDE_NAMES).optional(),
    wall: z.string().min(1).optional(),
    along: along().optional(),
    across: along().optional(),
    width: length().optional(),
    depth: length().optional(),
    surface: z.enum(SURFACE_IDS as [string, ...string[]]).optional(),
    seats: z.coerce.number().int().positive().optional(),
    rotation: z.coerce.number().int().min(-359).max(359).optional(),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const { room, level } = whereRoom(draft, args.level, args.room, 'add-object')
    const at =
      args.against !== undefined || args.wall !== undefined
        ? sideNamed(draft, level, room, { side: args.against, wall: args.wall }, 'add-object')
        : undefined

    const type = objectType(args.type)!
    const surface = args.surface ?? type.surfaces[0]!
    if (!type.surfaces.includes(surface)) {
      throw new CommandError(
        `add-object: a ${type.label.toLowerCase()} does not come in ${surface} — only ${type.surfaces.join(', ')}`,
      )
    }

    const climb = stairKind(type.id)
    const flight = climb ? stairShape(climb, draft.levels[level]!.height, args.width) : undefined
    if (flight && args.depth !== undefined) {
      throw new CommandError(
        `add-object: a staircase is as long as the storey makes it — ${flight.size.depth} mm for ${flight.risers} risers. Say --width, or build the storey at another height.`,
      )
    }

    const width = flight?.size.width ?? args.width ?? type.size.width
    const depth = flight?.size.depth ?? args.depth ?? type.size.depth
    const rotation = args.rotation

    const shape = { type: type.id, width, depth, rotation }
    const taken = takenBy(shape)
    const across =
      args.across === undefined ? undefined : fractionAcross(draft, room, args.across, 'add-object')
    const run = at ? sideRun(draft, level, room, at.side, at.nth) : undefined
    const window = at && run ? windowOf(run, at, room, 'add-object') : undefined

    const layer = layerOf(type.id)
    const abuts = type.abuts ?? false
    const spots =
      args.along !== undefined
        ? [
            {
              ...(at !== undefined ? { against: at.side } : {}),
              ...(at?.nth !== undefined ? { againstNth: at.nth } : {}),
              along: at
                ? alongSide(draft, level, room, at, args.along, 'add-object')
                : fractionOf(args.along, { length: freeWidth(draft, room) }, 'add-object'),
              ...(across !== undefined ? { across } : {}),
            },
          ]
        : at !== undefined
          ? placeAgainst(draft, level, room, at.side, taken.width, layer, abuts, at.nth, window)
          : type.stands === 'wall'
            ? placeSomewhereAgainst(draft, level, room, taken.width, layer, abuts)
            : placeFree(draft, room, taken.width, layer)

    const spot = spots.find((candidate) => canStand(draft, level, room, candidate, shape))

    if (!spot) {
      const first = spots[0]
      const problem =
        args.along !== undefined && first
          ? standingProblem(draft, level, room, first, shape)
          : undefined
      const where = at ? `against the ${at.side} side of ${room.name}` : `in ${room.name}`
      throw new CommandError(
        `add-object: a ${width} by ${depth} mm ${type.label.toLowerCase()} does not fit ${where}${problem ? `: ${problem}` : ''}`,
      )
    }

    const seats = args.seats ?? type.seats
    const id = allocateId(draft.objects, 'f')
    draft.objects[id] = {
      id,
      level,
      room: room.id,
      type: type.id,
      ...(spot.against ? { against: spot.against } : {}),
      ...(spot.againstNth !== undefined ? { againstNth: spot.againstNth } : {}),
      along: spot.along,
      ...(spot.across !== undefined ? { across: spot.across } : {}),
      width,
      depth,
      surface,
      ...(rotation ? { rotation } : {}),
      ...(seats ? { seats } : {}),
    }
    return { changed: [id] }
  },
})
