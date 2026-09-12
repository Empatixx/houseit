import type { HouseDocument } from '@houseit/core/document'
import { soffitOf } from '@houseit/core/levels'
import { roomsOf } from '@houseit/geometry/rooms'
import { elementId, wallElement } from '@houseit/geometry/wall-elements'
import { wallProfile } from '@houseit/geometry/wall-profile'
import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { deleteWall, straighten } from './graph'
import { json } from './json-schema'
import { length } from './length-schema'
import { checkFrame } from './opening-frame'
import { linkPoints } from './partition'
import { checkPockets } from './pocket-door'
import { rebind } from './rebind'
import { levelOf } from './resolve'

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
    'Edit an independent wall by id. --by moves perpendicular to its from→to direction: positive is left. Connected walls follow and openings keep their host and distance from the fixed end. Invalid joins or openings refuse the entire edit.',
  args: z.object({
    id: z.string().min(1),
    by: length().optional(),
    thickness: positive().optional(),
    height: positive().optional(),
    base: length().pipe(z.number().nonnegative()).optional(),
  }),
  run: (draft, args) => {
    if (
      args.by === undefined &&
      args.thickness === undefined &&
      args.height === undefined &&
      args.base === undefined
    )
      throw new CommandError('update-wall: provide --by, --thickness, --height or --base')
    const element = wallElement(draft, args.id)
    const level = element.level
    const moving = new Set(element.segments.flatMap(({ wall }) => [wall.a, wall.b]))
    const affected = Object.values(draft.walls).filter(
      (wall) => moving.has(wall.a) || moving.has(wall.b),
    )
    const before = new Map(
      affected.map((wall) => {
        const a = draft.nodes[wall.a]!,
          b = draft.nodes[wall.b]!
        return [wall.id, { dx: b.x - a.x, dy: b.y - a.y, length: Math.hypot(b.x - a.x, b.y - a.y) }]
      }),
    )
    const roomIds = roomsOf(draft, level)
      .filter((r) => r.id)
      .map((r) => r.id!)
    const dx = Math.round(-element.unit.y * (args.by ?? 0))
    const dy = Math.round(element.unit.x * (args.by ?? 0))
    for (const id of moving) {
      draft.nodes[id]!.x += dx
      draft.nodes[id]!.y += dy
    }
    for (const { wall } of element.segments) {
      if (args.thickness !== undefined) wall.thickness = args.thickness
      if (args.height !== undefined) wall.height = args.height
      if (args.base !== undefined) wall.baseOffset = args.base
      if (
        (args.height !== undefined || args.base !== undefined) &&
        wall.baseOffset + wall.height > soffitOf(draft.levels[level]!)
      )
        throw new CommandError('update-wall: the wall must fit below the storey soffit')
    }
    for (const wall of affected) {
      const old = before.get(wall.id)!,
        a = draft.nodes[wall.a]!,
        b = draft.nodes[wall.b]!
      const span = Math.hypot(b.x - a.x, b.y - a.y)
      if (span < 10 || old.dx * (b.x - a.x) + old.dy * (b.y - a.y) <= 0)
        throw new CommandError(
          `update-wall: connected wall ${elementId(wall)} would collapse or reverse`,
        )
      if (moving.has(wall.a) === moving.has(wall.b)) continue
      for (const opening of Object.values(draft.openings)) {
        if (opening.wall !== wall.id) continue
        const fromFixed = (moving.has(wall.a) ? 1 - opening.t : opening.t) * old.length
        opening.t = moving.has(wall.a) ? 1 - fromFixed / span : fromFixed / span
      }
    }
    for (const id of new Set(affected.map(elementId))) wallElement(draft, id)
    validateWalls(draft, level)
    rebind(draft, level)
    if (roomIds.some((id) => !draft.rooms[id]?.loop.length))
      throw new CommandError('update-wall: this move would destroy an existing room')
    return { changed: [...new Set([...affected.map(elementId), ...roomIds])], at: level }
  },
})

export function validateWalls(doc: HouseDocument, level: string) {
  const walls = Object.values(doc.walls).filter((w) => w.level === level)
  for (const wall of walls) {
    const a = doc.nodes[wall.a]!,
      b = doc.nodes[wall.b]!
    const span = Math.hypot(b.x - a.x, b.y - a.y)
    if (span < 10) throw new CommandError(`Wall ${wall.id} is too short`)
    if (wall.baseOffset < 0 || wall.baseOffset >= soffitOf(doc.levels[level]!))
      throw new CommandError(`Wall ${wall.id} starts outside the storey`)
    wallProfile(doc, wall)
    const openings = Object.values(doc.openings).filter((o) => o.wall === wall.id)
    for (const o of openings) {
      if (o.t * span - o.width / 2 < -0.1 || o.t * span + o.width / 2 > span + 0.1)
        throw new CommandError(`Opening ${o.id} no longer fits wall ${elementId(wall)}`)
      if (
        o.sillHeight < 0 ||
        o.sillHeight + o.height >
          Math.min(wall.height, soffitOf(doc.levels[level]!) - wall.baseOffset)
      )
        throw new CommandError(`Opening ${o.id} no longer fits the wall height`)
      checkFrame(doc, o, 'wall')
      for (const other of openings) {
        if (o.id >= other.id) continue
        if (
          Math.abs(o.t - other.t) * span < (o.width + other.width) / 2 - 0.1 &&
          o.sillHeight < other.sillHeight + other.height &&
          other.sillHeight < o.sillHeight + o.height
        )
          throw new CommandError(`Openings ${o.id} and ${other.id} overlap`)
      }
    }
  }
  for (let i = 0; i < walls.length; i++) {
    const one = walls[i]!,
      a = doc.nodes[one.a]!,
      b = doc.nodes[one.b]!
    for (const other of walls.slice(i + 1)) {
      const c = doc.nodes[other.a]!,
        d = doc.nodes[other.b]!
      const u = { x: b.x - a.x, y: b.y - a.y },
        v = { x: d.x - c.x, y: d.y - c.y }
      const cross = u.x * v.y - u.y * v.x
      if (Math.abs(cross) < 1e-6) {
        if (Math.abs((c.x - a.x) * u.y - (c.y - a.y) * u.x) > 0.1) continue
        const norm = u.x * u.x + u.y * u.y
        const t0 = ((c.x - a.x) * u.x + (c.y - a.y) * u.y) / norm
        const t1 = ((d.x - a.x) * u.x + (d.y - a.y) * u.y) / norm
        if (Math.min(1, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1)) > 1e-6)
          throw new CommandError(`Walls ${one.id} and ${other.id} overlap`)
        continue
      }
      const t = ((c.x - a.x) * v.y - (c.y - a.y) * v.x) / cross
      const s = ((c.x - a.x) * u.y - (c.y - a.y) * u.x) / cross
      if (t < -1e-6 || t > 1 + 1e-6 || s < -1e-6 || s > 1 + 1e-6) continue
      if ([one.a, one.b].some((n) => n === other.a || n === other.b)) continue
      throw new CommandError(`Walls ${one.id} and ${other.id} would cross without a junction`)
    }
  }
  checkPockets(doc, level, 'wall')
}

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
