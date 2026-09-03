import { FLOOR_MATERIAL_IDS } from '@houseit/core/floor-materials'
import { z } from 'zod'
import { defineCommand } from './define-command'
import { levelOf, roomNamed } from './resolve'

/**
 * Lays a floor in one room.
 *
 * Every room already has a floor: `floor-shape` and `add-room` both insist on one,
 * so this is for changing it rather than for supplying what was missing.
 *
 * The material is stored on the room record, not on the face it currently
 * occupies, so it stays where it was put when a partition moves and the faces are
 * all recomputed. Cut a room in two and the half that keeps the name keeps the
 * floor; the new half gets whatever the cut asked for.
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
    const level = levelOf(draft, args.level, 'set-floor')
    const room = roomNamed(draft, level, args.room, 'set-floor')
    draft.rooms[room.id]!.floor = args.material
  },
})
