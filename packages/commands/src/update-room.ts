import { FLOOR_MATERIAL_IDS } from '@houseit/core/floor-materials'
import { ROOM_KIND_IDS } from '@houseit/core/room-kinds'
import { roomsOf } from '@houseit/geometry/rooms'
import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { length } from './length-schema'
import { moveWall } from './move-wall'
import { SIDE_NAMES, whereRoom } from './resolve'

/**
 * Changes a room that is already cut: its name, what sort of room it is, its
 * floor, and how big it is.
 *
 * Bigger is a wall moved, and a wall moved is one room made bigger and the room
 * on the other side made smaller — which is why it is said of the room and not
 * of the wall. `--side north --by 200` pushes the whole line of that side out
 * by 200 mm, taking the doors and windows in it along and refusing the move if
 * anything would end up inside a wall.
 */
export const updateRoom = defineCommand({
  name: 'update-room',
  summary: `Change a room: its name, its kind (${ROOM_KIND_IDS.join(', ')}), its floor, or how big it is`,
  args: z.object({
    room: z.string().min(1),
    /** What to call it. No two rooms on a level may share a name. */
    name: z.string().trim().min(1).optional(),
    /** What sort of room it is, where the name does not say. */
    kind: z.enum(ROOM_KIND_IDS as [string, ...string[]]).optional(),
    material: z.enum(FLOOR_MATERIAL_IDS as [string, ...string[]]).optional(),
    /** With --by: the side to move. Or the very wall by its id, for an L's second wall on a side. */
    side: z.enum(SIDE_NAMES).optional(),
    wall: z.string().min(1).optional(),
    /** How far to move that side, outward; a minus is inward. `-300`, `0.5m`. */
    by: length().optional(),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const { room, level } = whereRoom(draft, args.level, args.room, 'update-room')

    if (
      args.name === undefined &&
      args.kind === undefined &&
      args.material === undefined &&
      args.by === undefined
    ) {
      throw new CommandError(
        'update-room: say what to change — --name, --kind, --material, or --side with --by',
      )
    }
    if (args.by === undefined && (args.side !== undefined || args.wall !== undefined)) {
      throw new CommandError('update-room: say how far that side moves, with --by')
    }
    if (args.name !== undefined) {
      const taken = roomsOf(draft, level).some(
        (other) => other.id !== room.id && other.name === args.name,
      )
      if (taken) throw new CommandError(`update-room: there is already a room called ${args.name}`)
    }

    // The wall first: it can be refused, and a room renamed by a command that
    // then refuses the move would be renamed in a plan that never changed.
    const changed =
      args.by === undefined
        ? [room.id]
        : (moveWall.apply(draft, {
            room: args.room,
            ...(args.side === undefined ? {} : { side: args.side }),
            ...(args.wall === undefined ? {} : { wall: args.wall }),
            by: args.by,
            level,
          })?.changed ?? [room.id])

    const record = draft.rooms[room.id]!
    if (args.name !== undefined) record.name = args.name
    if (args.kind !== undefined) record.kind = args.kind
    if (args.material !== undefined) record.floor = args.material
    return { changed }
  },
})
