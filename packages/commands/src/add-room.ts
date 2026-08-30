import { type Axis, crossingsOf, sideIsStraight } from '@houseit/geometry/cut'
import { roomsOf } from '@houseit/geometry/rooms'
import { z } from 'zod'
import { allocateId } from './allocate-id'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { length } from './length-schema'
import { splitWall } from './split-wall'

const PARTITION_THICKNESS = 150

/** Plans are drawn with +y north, so the compass maps onto the axes directly. */
const SIDES = {
  west: { axis: 'x', fromLow: true },
  east: { axis: 'x', fromLow: false },
  south: { axis: 'y', fromLow: true },
  north: { axis: 'y', fromLow: false },
} as const satisfies Record<string, { axis: Axis; fromLow: boolean }>

/**
 * A room is cut out of another room, never placed at coordinates. Nobody knows
 * that the kitchen starts at 4500 — that number is an outcome of the design, not
 * an input to it. What you know is that the kitchen is west of the living room and
 * three and a half metres wide.
 *
 * Cutting also settles the shared partition for free: the wall goes in between two
 * nodes split out of the walls it meets, so both rooms are bounded by the one
 * wall. Placing rooms side by side instead would leave two parallel walls with a
 * gap between them.
 */
export const addRoom = defineCommand({
  name: 'add-room',
  summary: 'Cut a new room off one side of an existing room',
  args: z.object({
    name: z.string().min(1),
    from: z.string().min(1),
    side: z.enum(['north', 'south', 'east', 'west']),
    width: length(),
    thickness: length().default(PARTITION_THICKNESS),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = args.level ?? Object.keys(draft.levels)[0]
    if (!level || !draft.levels[level]) {
      throw new CommandError(`add-room: unknown level ${args.level ?? '<none>'}`)
    }

    const source = roomsOf(draft, level).find((room) => room.name === args.from)
    if (!source) {
      throw new CommandError(`add-room: there is no room called ${args.from}`)
    }

    const { axis, fromLow } = SIDES[args.side]
    const points = source.nodes.map((id) => draft.nodes[id]!)
    const low = Math.min(...points.map((point) => point[axis]))
    const high = Math.max(...points.map((point) => point[axis]))

    if (args.width >= high - low) {
      throw new CommandError(
        `add-room: ${args.name} is wider than ${args.from}, which is only ${high - low} mm across`,
      )
    }
    const at = fromLow ? low + args.width : high - args.width
    const far = fromLow ? low : high

    if (!sideIsStraight(draft, source, axis, at, far)) {
      throw new CommandError(
        `add-room: the ${args.side} side of ${args.from} is stepped, so cutting there would ` +
          `leave a tail along the step — cut from a straight side first`,
      )
    }

    const crossings = crossingsOf(draft, level, source, axis, at)
    if (crossings.length !== 2) {
      throw new CommandError(
        `add-room: a straight partition there would meet ${args.from} in ${crossings.length} places, not two`,
      )
    }

    const ends = crossings.map((crossing) => splitWall(draft, crossing.wall, crossing.point))
    const partitionId = allocateId(draft.walls, 'w')
    draft.walls[partitionId] = {
      id: partitionId,
      level,
      a: ends[0]!,
      b: ends[1]!,
      thickness: args.thickness,
      baseOffset: 0,
      height: draft.levels[level].height,
    }

    // Anchor both names deliberately rather than letting the old label fall into
    // whichever half happens to contain it.
    const across: Axis = axis === 'x' ? 'y' : 'x'
    const middle = Math.round((crossings[0]!.point[across] + crossings[1]!.point[across]) / 2)
    const anchor = (value: number) =>
      axis === 'x' ? { x: value, y: middle } : { x: middle, y: value }

    const cut = anchor(Math.round((fromLow ? low + at : high + at) / 2))
    const rest = anchor(Math.round((fromLow ? at + high : low + at) / 2))

    const labelId = allocateId(draft.roomLabels, 'r')
    draft.roomLabels[labelId] = { id: labelId, level, ...cut, name: args.name }

    const previous = Object.values(draft.roomLabels).find((label) => label.id === source.labelId)
    if (previous) {
      previous.x = rest.x
      previous.y = rest.y
    }
  },
})
