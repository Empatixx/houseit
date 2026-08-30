import { roomsOf } from '@houseit/geometry/rooms'
import { z } from 'zod'
import { allocateId } from './allocate-id'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { length } from './length-schema'
import { placeOpening } from './place-opening'

const DEFAULT_WIDTH = 800
const DEFAULT_HEIGHT = 1970

/**
 * A door is placed the same way a window is — by room and compass side — which
 * covers both cases without a second shape. The east side of the kitchen is the
 * partition it shares with the living room, so that is an internal door; the
 * south side of the house is an outside wall, so that is the front door.
 *
 * It swings into the room you named it from. That is the one thing a door needs
 * that a window does not, and the room is the only place the answer can come
 * from.
 */
export const addDoor = defineCommand({
  name: 'add-door',
  summary: 'Put a door in the wall on one side of a room',
  args: z.object({
    room: z.string().min(1),
    side: z.enum(['north', 'south', 'east', 'west']),
    width: length().default(DEFAULT_WIDTH),
    height: length().default(DEFAULT_HEIGHT),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = args.level ?? Object.keys(draft.levels)[0]
    if (!level || !draft.levels[level]) {
      throw new CommandError(`add-door: unknown level ${args.level ?? '<none>'}`)
    }

    const room = roomsOf(draft, level).find((candidate) => candidate.name === args.room)
    if (!room) {
      throw new CommandError(`add-door: there is no room called ${args.room}`)
    }

    const spot = placeOpening(draft, level, room, args.side, args.width, 'add-door')
    const id = allocateId(draft.openings, 'o')
    draft.openings[id] = {
      id,
      wall: spot.wall,
      t: spot.t,
      kind: 'door',
      width: args.width,
      height: args.height,
      sillHeight: 0,
      hinge: 'a',
      swing: spot.swing,
    }
  },
})
