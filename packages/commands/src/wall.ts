import { soffitOf } from '@houseit/core/levels'
import { roomsOf } from '@houseit/geometry/rooms'
import { wallElement } from '@houseit/geometry/wall-elements'
import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { deleteWall, straighten } from './graph'
import { json } from './json-schema'
import { length } from './length-schema'
import { linkPoints } from './partition'
import { rebind } from './rebind'
import { levelOf } from './resolve'
import { validateWalls } from './validate-walls'
import { furnitureBefore, retainFurniture } from './wall-furniture'
import { resizeWallEnd } from './wall-length'
import { moveWallTopology } from './wall-topology'

const positive = () => length().pipe(z.number().positive())
const point = json(z.object({ x: length(), y: length() }))

export const addWall = defineCommand({
  name: 'add-wall',
  summary:
    'Add an independent straight wall. --from and --to are JSON {x,y} centreline coordinates in mm. Junctions split topology while retaining the wall id. Closed spaces become derived rooms.',
  args: z.object({
    from: point,
    to: point,
    thickness: positive().default(150),
    height: positive().optional(),
    base: length().pipe(z.number().nonnegative()).default(0),
    level: z.string().optional(),
  }),
  run: (draft, args, open) => {
    const level = levelOf(draft, args.level ?? open, 'add-wall')
    const span = Math.hypot(args.to.x - args.from.x, args.to.y - args.from.y)
    if (span < 10) throw new CommandError('add-wall: a wall must be at least 10 mm long')
    const height = args.height ?? soffitOf(draft.levels[level]!) - args.base
    if (height <= 0 || args.base + height > soffitOf(draft.levels[level]!))
      throw new CommandError('add-wall: the wall must fit below the storey soffit')
    const made = linkPoints(draft, level, args.from, args.to, args.thickness, 'add-wall')
    const covered = made.reduce((sum, id) => {
      const wall = draft.walls[id]!,
        a = draft.nodes[wall.a]!,
        b = draft.nodes[wall.b]!
      return sum + Math.hypot(b.x - a.x, b.y - a.y)
    }, 0)
    if (Math.abs(covered - span) > 2)
      throw new CommandError('add-wall: this run overlaps an existing wall')
    for (const id of made)
      Object.assign(draft.walls[id]!, { element: made[0]!, height, baseOffset: args.base })
    validateWalls(draft, level)
    return { changed: [made[0]!], at: level }
  },
})

export const updateWall = defineCommand({
  name: 'update-wall',
  summary:
    'Edit an independent wall by id. --by moves perpendicular to its from→to direction: positive is left. --length moves a free endpoint (--end from|to, default to), keeping the other end fixed. Connected walls follow and openings keep their host and distance from the fixed end. Invalid joins or openings refuse the entire edit.',
  args: z.object({
    id: z.string().min(1),
    by: length().optional(),
    length: positive().optional(),
    end: z.enum(['from', 'to']).optional(),
    thickness: positive().optional(),
    height: positive().optional(),
    base: length().pipe(z.number().nonnegative()).optional(),
  }),
  run: (draft, args) => {
    if (
      args.by === undefined &&
      args.length === undefined &&
      args.thickness === undefined &&
      args.height === undefined &&
      args.base === undefined
    )
      throw new CommandError('update-wall: provide --by, --length, --thickness, --height or --base')
    if (args.end !== undefined && args.length === undefined)
      throw new CommandError('update-wall: --end requires --length')
    if (args.length !== undefined && args.by !== undefined)
      throw new CommandError('update-wall: change --length or --by in separate commands')
    const element = wallElement(draft, args.id)
    const level = element.level
    const furniture = furnitureBefore(draft, level)
    const roomIds = roomsOf(draft, level)
      .filter((r) => r.id)
      .map((r) => r.id!)
    const affected =
      args.length === undefined
        ? moveWallTopology(draft, element.id, args.by ?? 0, 'element')
        : resizeWallEnd(draft, element.id, args.length, args.end ?? 'to')
    for (const { wall } of wallElement(draft, element.id).segments) {
      if (args.thickness !== undefined) wall.thickness = args.thickness
      if (args.height !== undefined) wall.height = args.height
      if (args.base !== undefined) wall.baseOffset = args.base
      if (
        (args.height !== undefined || args.base !== undefined) &&
        wall.baseOffset + wall.height > soffitOf(draft.levels[level]!)
      )
        throw new CommandError('update-wall: the wall must fit below the storey soffit')
    }
    validateWalls(draft, level)
    rebind(draft, level)
    if (roomIds.some((id) => !draft.rooms[id]?.loop.length))
      throw new CommandError('update-wall: this move would destroy an existing room')
    retainFurniture(draft, level, furniture)
    return { changed: [...new Set([...affected, ...roomIds])], at: level }
  },
})

export const removeWall = defineCommand({
  name: 'remove-wall',
  summary:
    'Remove an independent wall and its openings, then derive the remaining rooms. Unbound empty room labels are removed. Furnished adjacent rooms need remove-room --into to preserve furniture placement.',
  args: z.object({ id: z.string().min(1) }),
  run: (draft, args) => {
    const element = wallElement(draft, args.id)
    const ids = new Set(element.segments.map((s) => s.wall.id))
    const ends = new Set(element.segments.flatMap((s) => [s.wall.a, s.wall.b]))
    const adjacent = Object.values(draft.rooms).filter((r) => r.loop.some((id) => ids.has(id)))
    if (Object.values(draft.objects).some((o) => adjacent.some((r) => r.id === o.room)))
      throw new CommandError(
        'remove-wall: an adjacent room is furnished; use remove-room --into to preserve object placement',
      )
    if (
      Object.values(draft.devices).some((d) => d.host.kind === 'wall' && ids.has(d.host.wall)) ||
      Object.values(draft.circuits).some((c) =>
        c.route?.some((h) => h.kind === 'wall' && ids.has(h.wall)),
      )
    )
      throw new CommandError('remove-wall: electrical hosts still reference this wall')
    const openings = Object.values(draft.openings)
      .filter((o) => ids.has(o.wall))
      .map((o) => o.id)
    for (const id of ids) deleteWall(draft, element.level, id)
    for (const id of ends) if (draft.nodes[id]) straighten(draft, element.level, id)
    rebind(draft, element.level)
    const lost = adjacent.filter((r) => draft.rooms[r.id]!.loop.length === 0)
    for (const room of lost) delete draft.rooms[room.id]
    return {
      changed: [element.id, ...openings, ...adjacent.map((r) => r.id)],
      at: element.level,
      notes: lost.map(
        (r) =>
          `Removed the ${r.name} label and finishes because its enclosed space no longer exists`,
      ),
    }
  },
})
