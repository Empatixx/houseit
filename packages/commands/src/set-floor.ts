import { FLOOR_MATERIAL_IDS } from '@houseit/core/floor-materials'
import { roomsOf } from '@houseit/geometry/rooms'
import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'

/**
 * Lays a floor in one room.
 *
 * The material is stored on the room record, not on the face it currently
 * occupies, so it stays where it was put when a partition moves and the faces are
 * all recomputed. Cut a room in two and the half that keeps the name keeps the
 * floor; the new half starts bare.
 *
 * The list of materials comes from the catalogue, so `--help` and the MCP tool
 * description stay in step with it without a second copy of the list.
 */
export const setFloor = defineCommand({
  name: 'set-floor',
  summary: `Lay a floor in a room (${FLOOR_MATERIAL_IDS.join(', ')})`,
  args: z.object({
    room: z.string().min(1),
    material: z.enum(FLOOR_MATERIAL_IDS as [string, ...string[]]),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = args.level ?? Object.keys(draft.levels)[0]
    if (!level || !draft.levels[level]) {
      throw new CommandError(`set-floor: unknown level ${args.level ?? '<none>'}`)
    }

    const room = roomsOf(draft, level).find((candidate) => candidate.name === args.room)
    if (!room?.id) {
      throw new CommandError(`set-floor: there is no room called ${args.room}`)
    }

    draft.rooms[room.id]!.floor = args.material
  },
})
