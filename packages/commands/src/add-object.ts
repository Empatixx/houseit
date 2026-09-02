import { layerOf, OBJECT_TYPE_IDS, objectType } from '@houseit/core/object-types'
import { SURFACE_IDS } from '@houseit/core/surfaces'
import { fitsInside } from '@houseit/geometry/fits'
import { roomsOf } from '@houseit/geometry/rooms'
import { footprintOf, reachOf, standingAt, swingOf } from '@houseit/geometry/standing'
import { z } from 'zod'
import { allocateId } from './allocate-id'
import { boxOf, clashes, INSIDE_A_WALL, wallBox } from './boxes'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { length } from './length-schema'
import { placeAgainst, placeFree, placeSomewhereAgainst } from './place-object'

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

    // What the thing really takes up: what it reaches once it is turned, plus
    // whatever it spreads past that. The same numbers are used to look for a spot
    // and to check the spot found, or the search offers places the check refuses.
    const spread = type.reach ?? 0
    const reach = reachOf({ width, depth, turn })
    const taken = { width: reach.across + spread * 2, depth: reach.into + spread * 2 }

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

    // Every candidate is put where the drawing would put it and then checked
    // against the room itself, so nothing lands half in the room next door. The
    // two have to be worked out by the same code, or the check means nothing.
    const spot = spots.find((candidate) => {
      const at = standingAt(draft, level, room, { ...candidate, width, depth, turn })
      if (!at) return false

      // What a thing spreads past itself, it spreads into the room — never back
      // through the wall it is standing against. A bed wants half a metre either
      // side and at the foot and none at all behind the headboard, and counting
      // it behind as well is what put the bed through the bedroom wall.
      const needs = candidate.against ? { width: taken.width, depth: reach.into + spread } : taken
      const forward = candidate.against ? spread / 2 : 0
      const middle = {
        at: {
          x: at.at.x - Math.sin(at.turn) * forward,
          y: at.at.y + Math.cos(at.turn) * forward,
        },
        // Square to the wall, not to the thing: `needs` is already the box the
        // turned shape fills, so turning that box again counts the turn twice.
        turn: at.turn - swingOf({ turn }),
      }
      if (!fitsInside(draft, room, footprintOf(middle, needs))) return false

      // And clear of the walls themselves. A room is drawn on their centre lines,
      // so a thing can sit inside the room and inside half a wall at the same
      // time — which is exactly what the bedside table did.
      const box = boxOf(footprintOf(at, { width, depth }))
      const buried = Object.values(draft.walls)
        .filter((wall) => wall.level === level)
        .some((wall) => {
          const from = draft.nodes[wall.a]
          const to = draft.nodes[wall.b]
          return (
            from !== undefined &&
            to !== undefined &&
            clashes(box, wallBox(from, to, wall.thickness), INSIDE_A_WALL)
          )
        })
      if (buried) return false

      // And clear of whatever is already standing there. Keeping to the free
      // stretches of one wall was never the whole job: a wall has two ends, and
      // each of them is a corner it shares with the wall round it — which is how
      // an armchair at the west wall ended up sitting in the sofa.
      return !Object.values(draft.objects)
        .filter(
          (other) =>
            other.room === room.id && other.level === level && layerOf(other.type) === layer,
        )
        .some((other) => {
          const stood = standingAt(draft, level, room, other)
          return stood !== undefined && clashes(box, boxOf(footprintOf(stood, other)))
        })
    })

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
