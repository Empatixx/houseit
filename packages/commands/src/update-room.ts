import {
  BATHROOM_KINDS,
  finishesFor,
  PARTS,
  type Part,
  STYLE_IDS,
  styleOf,
} from '@houseit/core/finishes'
import { FLOOR_MATERIAL_IDS } from '@houseit/core/floor-materials'
import { ROOM_KIND_IDS, roomKindOf } from '@houseit/core/room-kinds'
import { roomsOf } from '@houseit/geometry/rooms'
import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { length } from './length-schema'
import { moveWall } from './move-wall'
import { SIDE_NAMES, whereRoom } from './resolve'

const wearing = (part: Part) =>
  z.enum(finishesFor(part).map((finish) => finish.id) as [string, ...string[]]).optional()

export const updateRoom = defineCommand({
  name: 'update-room',
  summary: `Change a room: its name, its kind (${ROOM_KIND_IDS.join(', ')}), its floor, its style (${STYLE_IDS.join(', ')}) or what its walls, ceiling, doors and windows are finished in, or how big it is`,
  args: z.object({
    room: z.string().min(1),
    name: z.string().trim().min(1).optional(),
    kind: z.enum(ROOM_KIND_IDS as [string, ...string[]]).optional(),
    material: z.enum(FLOOR_MATERIAL_IDS as [string, ...string[]]).optional(),
    style: z.enum(STYLE_IDS as [string, ...string[]]).optional(),
    walls: wearing('walls'),
    ceiling: wearing('ceiling'),
    doors: wearing('doors'),
    windows: wearing('windows'),
    side: z.enum(SIDE_NAMES).optional(),
    wall: z.string().min(1).optional(),
    by: length().optional(),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const { room, level } = whereRoom(draft, args.level, args.room, 'update-room')

    const dressed = args.style !== undefined || PARTS.some((part) => args[part] !== undefined)
    if (
      args.name === undefined &&
      args.kind === undefined &&
      args.material === undefined &&
      args.by === undefined &&
      !dressed
    ) {
      throw new CommandError(
        'update-room: say what to change — --name, --kind, --material, --style, --walls, --ceiling, --doors, --windows, or --side with --by',
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
    const style = styleOf(args.style)
    if (style) {
      const kind = roomKindOf(record)?.id
      record.style = style.id
      record.floor =
        kind !== undefined && BATHROOM_KINDS.includes(kind)
          ? style.defaults.bathroomFloor
          : style.defaults.floor
      for (const part of PARTS) record[part] = style.defaults[part]
    }
    if (args.material !== undefined) record.floor = args.material
    for (const part of PARTS) {
      const finish = args[part]
      if (finish !== undefined) record[part] = finish
    }
    return { changed }
  },
})
