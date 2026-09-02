import { layerOf, OBJECT_TYPE_IDS, objectType } from '@houseit/core/object-types'
import { SURFACE_IDS } from '@houseit/core/surfaces'
import { roomsOf } from '@houseit/geometry/rooms'
import { z } from 'zod'
import { allocateId } from './allocate-id'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { length } from './length-schema'
import { placeAgainst, placeFree, placeSomewhereAgainst } from './place-object'
import { canStand, takenBy } from './standing-check'

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
    against: z.enum(['north', 'south', 'east', 'west']).optional(),
    /**
     * Where along that side, or across the room, 0 at one end and 1 at the
     * other. Left out, the place is chosen — which is nearly always right. Said,
     * it is checked like any other place and refused if something is there.
     */
    along: z.coerce.number().min(0).max(1).optional(),
    /** Standing free: how far up the room, 0 south and 1 north. Left out, the middle. */
    across: z.coerce.number().min(0).max(1).optional(),
    width: length().optional(),
    depth: length().optional(),
    surface: z.enum(SURFACE_IDS as [string, ...string[]]).optional(),
    seats: z.coerce.number().int().positive().optional(),
    /** Degrees, turned about its own middle on top of the way it faces. */
    turn: z.coerce.number().int().min(-359).max(359).optional(),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = args.level ?? Object.keys(draft.levels)[0]
    if (!level || !draft.levels[level]) {
      throw new CommandError(`add-object: unknown level ${args.level ?? '<none>'}`)
    }

    const room = roomsOf(draft, level).find((candidate) => candidate.name === args.room)
    if (!room?.id) {
      throw new CommandError(`add-object: there is no room called ${args.room}`)
    }

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

    const layer = layerOf(type.id)
    const abuts = type.abuts ?? false
    const spots =
      args.along !== undefined
        ? [
            {
              ...(args.against !== undefined ? { against: args.against } : {}),
              along: args.along,
              ...(args.across !== undefined ? { across: args.across } : {}),
            },
          ]
        : args.against !== undefined
          ? placeAgainst(draft, level, room, args.against, taken.width, layer, abuts)
          : type.stands === 'wall'
            ? placeSomewhereAgainst(draft, level, room, taken.width, layer, abuts)
            : placeFree(draft, room, taken.width, layer)

    // Every candidate is checked the way a move is checked, by the same code —
    // or the check means nothing.
    const spot = spots.find((candidate) => canStand(draft, level, room, candidate, shape))

    if (!spot) {
      throw new CommandError(
        args.against
          ? `add-object: a ${width} by ${depth} mm ${type.label.toLowerCase()} does not fit against the ${args.against} side of ${args.room}`
          : `add-object: a ${width} by ${depth} mm ${type.label.toLowerCase()} does not fit in ${args.room}`,
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
