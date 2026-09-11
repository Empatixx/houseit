import { FLOOR_MATERIAL_IDS } from '@houseit/core/floor-materials'
import { ROOM_KIND_IDS } from '@houseit/core/room-kinds'
import { z } from 'zod'
import { along } from './along-schema'
import { CommandError } from './command-error'
import { CORNERS, type Corner } from './cut-corner'
import { BoundarySchema, roomByBoundary } from './cuts/boundary'
import { cutByCorner } from './cuts/corner'
import { drawOutline } from './cuts/outline'
import { cutByPoints } from './cuts/points'
import { named } from './cuts/settle'
import { cutBySide } from './cuts/side'
import { cutByWalk } from './cuts/walk'
import { defineCommand } from './define-command'
import { json } from './json-schema'
import { length } from './length-schema'
import { levelOf, SIDE_NAMES, whereRoom } from './resolve'

const PARTITION_THICKNESS = 150
const EXTERIOR_THICKNESS = 300

export const addRoom = defineCommand({
  name: 'add-room',
  summary: `A measured --boundary JSON [{x,y,thickness}] gives each wall-centre corner and the thickness of the outgoing edge, reusing shared walls exactly. Or draw the floor's outline (--shape rectangle|l|u|t, or --walk), or cut a room out of a room: a strip off a --side, a box out of a --corner, --points round it, or a --walk from a side (${FLOOR_MATERIAL_IDS.join(', ')})`,
  args: z.object({
    name: z.string().min(1),
    from: z.string().min(1).optional(),
    shape: z.enum(['rectangle', 'l', 'u', 't']).optional(),
    kind: z.enum(ROOM_KIND_IDS as [string, ...string[]]).optional(),
    side: z.enum(SIDE_NAMES).optional(),
    corner: z.enum(Object.keys(CORNERS) as [Corner, ...Corner[]]).optional(),
    width: length().optional(),
    depth: length().optional(),
    material: z.enum(FLOOR_MATERIAL_IDS as [string, ...string[]]),
    notchWidth: length().optional(),
    notchDepth: length().optional(),
    barDepth: length().optional(),
    stemWidth: length().optional(),
    points: z.string().min(1).optional(),
    boundary: json(BoundarySchema).optional(),
    walk: z.string().min(1).optional(),
    along: along().optional(),
    thickness: length().optional(),
    level: z.string().optional(),
  }),
  run: (draft, args, open) => {
    if (args.boundary !== undefined) {
      if (
        [
          args.from,
          args.shape,
          args.side,
          args.corner,
          args.points,
          args.walk,
          args.width,
          args.depth,
          args.thickness,
        ].some((v) => v !== undefined)
      )
        throw new CommandError(
          'add-room: --boundary is a complete measured wall-centre chain; do not combine it with another shape',
        )
      return named(
        draft,
        roomByBoundary(draft, levelOf(draft, args.level ?? open, 'add-room'), {
          ...args,
          boundary: args.boundary,
        }),
        args.kind,
      )
    }
    const cutting =
      args.from !== undefined ||
      args.side !== undefined ||
      args.corner !== undefined ||
      args.points !== undefined

    if (!cutting) {
      const made = drawOutline(draft, levelOf(draft, args.level ?? open, 'add-room'), {
        ...args,
        thickness: args.thickness ?? EXTERIOR_THICKNESS,
      })
      return named(draft, made, args.kind)
    }

    if (args.shape !== undefined) {
      throw new CommandError(
        'add-room: --shape draws the floor itself; a room inside one is cut with --side, --corner, --points or --walk',
      )
    }
    const cut = { ...args, thickness: args.thickness ?? PARTITION_THICKNESS }
    const ways = [args.side, args.corner, args.points, args.walk].filter((way) => way !== undefined)
    if (
      ways.length !== 1 &&
      !(args.walk !== undefined && ways.length === 2 && args.side !== undefined)
    ) {
      throw new CommandError(
        'add-room: say one shape — a --side to cut a strip off, a --corner to take a box out of, --points round it, or a --walk from a side',
      )
    }

    if (cut.points !== undefined) {
      const level =
        cut.from === undefined
          ? levelOf(draft, args.level ?? open, 'add-room')
          : whereRoom(draft, args.level, cut.from, 'add-room').level
      return named(draft, cutByPoints(draft, level, { ...cut, points: cut.points }), args.kind)
    }

    if (cut.from === undefined) {
      throw new CommandError('add-room: say which room it comes out of, with --from')
    }
    const { room: source, level } = whereRoom(draft, args.level, cut.from, 'add-room')

    if (cut.walk !== undefined) {
      return named(draft, cutByWalk(draft, level, source, cut), args.kind)
    }
    if (cut.corner !== undefined) {
      return named(
        draft,
        cutByCorner(draft, level, source, { ...cut, corner: cut.corner }),
        args.kind,
      )
    }
    return named(draft, cutBySide(draft, level, source, { ...cut, side: cut.side! }), args.kind)
  },
})
