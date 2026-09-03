import { layerOf, OBJECT_TYPE_IDS, objectType } from '@houseit/core/object-types'
import { SURFACE_IDS } from '@houseit/core/surfaces'
import { sideRun } from '@houseit/geometry/sides'
import { z } from 'zod'
import { allocateId } from './allocate-id'
import { along, alongSide, fractionAcross, fractionOf, windowOf } from './along-schema'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { length } from './length-schema'
import { freeWidth, placeAgainst, placeFree, placeSomewhereAgainst } from './place-object'
import { levelOf, roomNamed, SIDE_NAMES, sideNamed } from './resolve'
import { canStand, standingProblem, takenBy } from './standing-check'

/**
 * Puts something in a room.
 *
 * The type says what the thing is and how big it usually is; the command carries
 * the exceptions. Nothing carries a position — `place-object` works that out from
 * the room, because "in the kitchen, against the north wall" is what a person
 * knows and a coordinate is not.
 */
export const addObject = defineCommand({
  name: 'add-object',
  summary: `Put something in a room (${OBJECT_TYPE_IDS.join(', ')})`,
  args: z.object({
    room: z.string().min(1),
    type: z.enum(OBJECT_TYPE_IDS as [string, ...string[]]),
    /** The side it backs onto; the longest wall facing that way, if there are several. */
    against: z.enum(SIDE_NAMES).optional(),
    /** Or the very wall it backs onto, by its id from describe. */
    wall: z.string().min(1).optional(),
    /**
     * Where along that wall, or across the room: a fraction (0 at the west or
     * south end, 1 at the other) or a length from that end. Left out, the place
     * is chosen — which is nearly always right. Said, it is checked like any
     * other place and refused if something is there.
     */
    along: along().optional(),
    /** Standing free: how far up the room, a fraction (0 south, 1 north) or a length from the south. Left out, the middle. */
    across: along().optional(),
    width: length().optional(),
    depth: length().optional(),
    surface: z.enum(SURFACE_IDS as [string, ...string[]]).optional(),
    seats: z.coerce.number().int().positive().optional(),
    /** Degrees, turned about its own middle on top of the way it faces. */
    turn: z.coerce.number().int().min(-359).max(359).optional(),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'add-object')
    const room = roomNamed(draft, level, args.room, 'add-object')
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

    const width = args.width ?? type.size.width
    const depth = args.depth ?? type.size.depth
    const turn = args.turn

    const shape = { type: type.id, width, depth, turn }
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

    // Every candidate is checked the way a move is checked, by the same code —
    // or the check means nothing.
    const spot = spots.find((candidate) => canStand(draft, level, room, candidate, shape))

    if (!spot) {
      // One place was asked for, so the one reason it will not do is worth saying.
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
      ...(turn ? { turn } : {}),
      ...(seats ? { seats } : {}),
    }
  },
})
