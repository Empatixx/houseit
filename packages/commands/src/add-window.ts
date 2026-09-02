import { roomsOf } from '@houseit/geometry/rooms'
import { z } from 'zod'
import { allocateId } from './allocate-id'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { length } from './length-schema'
import { placeOpening } from './place-opening'

const DEFAULT_WIDTH = 1200
const DEFAULT_HEIGHT = 1500
const DEFAULT_SILL = 900

/**
 * A window is placed by room and compass side, never by distance along a wall.
 * You know the bedroom looks south; you do not know that its window starts 2.4 m
 * from the corner. Where along the wall it lands is `placeOpening`'s decision.
 */
export const addWindow = defineCommand({
  name: 'add-window',
  summary: 'Put a window in the wall on one side of a room',
  args: z.object({
    room: z.string().min(1),
    side: z.enum(['north', 'south', 'east', 'west']),
    width: length().default(DEFAULT_WIDTH),
    height: length().default(DEFAULT_HEIGHT),
    sill: length().default(DEFAULT_SILL),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = args.level ?? Object.keys(draft.levels)[0]
    if (!level || !draft.levels[level]) {
      throw new CommandError(`add-window: unknown level ${args.level ?? '<none>'}`)
    }

    const room = roomsOf(draft, level).find((candidate) => candidate.name === args.room)
    if (!room) {
      throw new CommandError(`add-window: there is no room called ${args.room}`)
    }

    const spot = placeOpening(draft, level, room, args.side, args.width, 'add-window')
    const id = allocateId(draft.openings, 'o')
    draft.openings[id] = {
      id,
      wall: spot.wall,
      t: spot.t,
      kind: 'window',
      variant: 'hinged',
      width: args.width,
      height: args.height,
      sillHeight: args.sill,
      hinge: 'a',
      swing: 1,
    }
  },
})
