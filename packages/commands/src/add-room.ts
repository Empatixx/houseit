import { FLOOR_MATERIAL_IDS } from '@houseit/core/floor-materials'
import { type Axis, crossingsOf, sideIsStraight } from '@houseit/geometry/cut'
import { roomsOf } from '@houseit/geometry/rooms'
import { z } from 'zod'
import { allocateId } from './allocate-id'
import { CommandError } from './command-error'
import { CORNERS, type Corner, cutCorner } from './cut-corner'
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
  summary: `Cut a new room off a side, or out of a corner, of an existing room (${FLOOR_MATERIAL_IDS.join(', ')})`,
  args: z.object({
    name: z.string().min(1),
    from: z.string().min(1),
    side: z.enum(['north', 'south', 'east', 'west']).optional(),
    corner: z.enum(Object.keys(CORNERS) as [Corner, ...Corner[]]).optional(),
    width: length(),
    /** Only a corner cut needs one: a side cut runs the whole way across. */
    depth: length().optional(),
    /**
     * Required, like on `floor-shape`. A room the plan cannot say the floor of is
     * a room somebody has to come back to, and nobody comes back.
     */
    material: z.enum(FLOOR_MATERIAL_IDS as [string, ...string[]]),
    /** A bite out of the new room's inner corner, which makes it L-shaped. */
    notchWidth: length().optional(),
    notchDepth: length().optional(),
    thickness: length().default(PARTITION_THICKNESS),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = args.level ?? Object.keys(draft.levels)[0]
    if (!level || !draft.levels[level]) {
      throw new CommandError(`add-room: unknown level ${args.level ?? '<none>'}`)
    }

    if ((args.side === undefined) === (args.corner === undefined)) {
      throw new CommandError('add-room: give either a side to cut off or a corner to take out')
    }

    const source = roomsOf(draft, level).find((room) => room.name === args.from)
    if (!source) {
      throw new CommandError(`add-room: there is no room called ${args.from}`)
    }

    if (args.corner) {
      if (args.depth === undefined) {
        throw new CommandError('add-room: a corner needs a depth as well as a width')
      }
      if ((args.notchWidth === undefined) !== (args.notchDepth === undefined)) {
        throw new CommandError('add-room: a notch needs both --notch-width and --notch-depth')
      }
      const corner = cutCorner(draft, level, source, args.corner, {
        width: args.width,
        depth: args.depth,
        thickness: args.thickness,
        ...(args.notchWidth !== undefined && args.notchDepth !== undefined
          ? { notch: { width: args.notchWidth, depth: args.notchDepth } }
          : {}),
      })
      settle(draft, level, source, args.name, args.material, corner.taken, corner.left)
      return
    }

    const { axis, fromLow } = SIDES[args.side!]
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

    settle(draft, level, source, args.name, args.material, cut, rest)
  },
})

/**
 * Records the room that was cut out and moves the one it came from into what is
 * left, rather than letting an old anchor decide which half keeps the name.
 */
function settle(
  draft: Parameters<typeof roomsOf>[0],
  level: string,
  source: { id?: string },
  name: string,
  material: string,
  taken: { x: number; y: number },
  left: { x: number; y: number },
): void {
  const id = allocateId(draft.rooms, 'r')
  draft.rooms[id] = { id, level, x: taken.x, y: taken.y, name, floor: material }

  const previous = source.id ? draft.rooms[source.id] : undefined
  if (previous) {
    previous.x = left.x
    previous.y = left.y
  }
}
