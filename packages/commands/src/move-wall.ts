import { SIDES, wallsOnSide } from '@houseit/geometry/sides'
import { elementId, wallElement } from '@houseit/geometry/wall-elements'
import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { length } from './length-schema'
import { SIDE_NAMES, sideNamed, whereRoom } from './resolve'
import { updateWall } from './wall'

export const moveWall = defineCommand({
  name: 'move-wall',
  summary:
    'Move an independent wall selected from a room; positive distance is outward. A side containing several independent walls requires --wall.',
  args: z.object({
    room: z.string().min(1),
    side: z.enum(SIDE_NAMES).optional(),
    wall: z.string().min(1).optional(),
    by: length(),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    try {
      const { level, room } = whereRoom(draft, args.level, args.room, 'move-wall')
      const at = sideNamed(draft, level, room, args, 'move-wall')
      const walls = at.wall
        ? [draft.walls[at.wall]!]
        : wallsOnSide(draft, level, room, at.side, at.nth).map((w) => draft.walls[w.wall]!)
      const ids = [...new Set(walls.map(elementId))]
      if (ids.length !== 1) throw new CommandError('select one independent wall with --wall')
      const wall = wallElement(draft, ids[0]!)
      const { axis, low } = SIDES[at.side]
      const outward = low ? -1 : 1
      const normal = axis === 'x' ? -wall.unit.y : wall.unit.x
      return updateWall.apply(draft, { id: wall.id, by: Math.round(args.by * outward * normal) })
    } catch (error) {
      throw new CommandError(`move-wall: ${error instanceof Error ? error.message : String(error)}`)
    }
  },
})
