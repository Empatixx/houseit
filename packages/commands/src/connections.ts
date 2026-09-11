import { RampSchema, ShaftSchema } from '@houseit/core/connections'
import type { HouseDocument } from '@houseit/core/document'
import { soffitOf } from '@houseit/core/levels'
import { boxOf, clashes, wallBox } from '@houseit/geometry/boxes'
import { connectionHoles, shaftOutside, shaftsOn } from '@houseit/geometry/connections'
import { containsPoint, roomsOf } from '@houseit/geometry/rooms'
import { z } from 'zod'
import { allocateId } from './allocate-id'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { json } from './json-schema'
import { length } from './length-schema'
import { levelOf } from './resolve'

const position = { x: length(), y: length(), width: length() }
export const addShaft = defineCommand({
  name: 'add-shaft',
  summary:
    'Hold a lift or --kind services shaft from --level through --to; a service shaft can occupy one storey. x,y centres the clear shaft. Optional --enclosure JSON gives thickness and colour, optionally doorSide, doorWidth and doorHeight together; its footprint is excluded from the surrounding room.',
  args: z.object({
    ...position,
    depth: length(),
    kind: ShaftSchema.shape.kind.optional(),
    to: z.string(),
    level: z.string().optional(),
    enclosure: json(ShaftSchema.shape.enclosure.unwrap()).optional(),
  }),
  run: (draft, args, open) => {
    const level = levelOf(draft, args.level ?? open, 'add-shaft')
    const to = levelOf(draft, args.to, 'add-shaft')
    if (
      draft.levels[to]!.elevation < draft.levels[level]!.elevation ||
      (to === level && args.kind !== 'services')
    )
      throw new CommandError('shaft must reach a higher storey')
    const all = Object.fromEntries(
      Object.values(draft.levels).flatMap((l) => (l.shafts ?? []).map((s) => [s.id, s])),
    )
    const shaft = ShaftSchema.parse({ ...args, to, id: allocateId(all, 'shaft') })
    if (shaft.enclosure) {
      const e = shaft.enclosure
      const side = e.doorSide === 'north' || e.doorSide === 'south' ? shaft.width : shaft.depth
      if (e.doorWidth !== undefined && e.doorWidth >= side)
        throw new CommandError('shaft door must fit within the clear shaft side')
      for (const storey of Object.values(draft.levels).filter(
        (l) =>
          l.elevation >= draft.levels[level]!.elevation &&
          l.elevation <= draft.levels[to]!.elevation,
      )) {
        if (e.doorHeight !== undefined && e.doorHeight >= soffitOf(storey))
          throw new CommandError('shaft door must fit below the soffit')
        const corners = shaftOutside(shaft)
        const voidCorners = shaftOutside({ ...shaft, enclosure: undefined })
        if (
          shaftsOn(draft, storey.id).some((s) => clashes(boxOf(corners), boxOf(shaftOutside(s)), 0))
        )
          throw new CommandError('shaft would overlap another shaft')
        if (
          (storey.columns ?? []).some((c) =>
            clashes(
              boxOf(corners),
              {
                x0: c.x - c.width / 2,
                x1: c.x + c.width / 2,
                y0: c.y - c.depth / 2,
                y1: c.y + c.depth / 2,
              },
              0,
            ),
          )
        )
          throw new CommandError('shaft would overlap a structural column')
        if (
          !roomsOf(draft, storey.id).some((r) =>
            voidCorners.every((p) =>
              containsPoint(
                r.nodes.map((id) => draft.nodes[id]!),
                p.x,
                p.y,
              ),
            ),
          )
        )
          throw new CommandError(`enclosed shaft must stand inside one room on ${storey.name}`)
        for (const wall of Object.values(draft.walls).filter((w) => w.level === storey.id)) {
          if (
            clashes(
              boxOf(voidCorners),
              wallBox(draft.nodes[wall.a]!, draft.nodes[wall.b]!, wall.thickness),
              0,
            )
          )
            throw new CommandError(`shaft void intersects wall ${wall.id}`)
        }
      }
    }
    const record = draft.levels[level]!
    record.shafts ??= []
    record.shafts.push(shaft)
    checkHoles(draft)
    return { changed: [shaft.id], at: level }
  },
})
export const addRamp = defineCommand({
  name: 'add-ramp',
  summary:
    'A ramp from --level up to --to, or --to-elevation for a site level in mm above the building datum. Optional --base-offset adjusts its lower end. x,y is the centre of its lower end; --direction points uphill and --length is the horizontal run.',
  args: z.object({
    ...position,
    length: length(),
    direction: RampSchema.shape.direction,
    thickness: length(),
    colour: RampSchema.shape.colour,
    to: z.string().optional(),
    toElevation: length().optional(),
    baseOffset: length().optional(),
    level: z.string().optional(),
  }),
  run: (draft, args, open) => {
    const level = levelOf(draft, args.level ?? open, 'add-ramp')
    if ((args.to === undefined) === (args.toElevation === undefined))
      throw new CommandError('add-ramp: name exactly one of --to and --to-elevation')
    const to = args.to === undefined ? undefined : levelOf(draft, args.to, 'add-ramp')
    const destination = to ? draft.levels[to]!.elevation : args.toElevation!
    if (destination <= draft.levels[level]!.elevation + (args.baseOffset ?? 0))
      throw new CommandError('ramp must rise above its lower end')
    const all = Object.fromEntries(
      Object.values(draft.levels).flatMap((l) => (l.ramps ?? []).map((r) => [r.id, r])),
    )
    const ramp = RampSchema.parse({ ...args, to, id: allocateId(all, 'ramp') })
    const record = draft.levels[level]!
    record.ramps ??= []
    record.ramps.push(ramp)
    checkHoles(draft)
    return { changed: [ramp.id], at: level }
  },
})
function checkHoles(doc: HouseDocument) {
  for (const level of Object.values(doc.levels)) {
    for (const hole of connectionHoles(doc, level.id)) {
      for (const wall of Object.values(doc.walls).filter((w) => w.level === level.id)) {
        if (
          clashes(
            boxOf(hole.outline),
            wallBox(doc.nodes[wall.a]!, doc.nodes[wall.b]!, wall.thickness),
            0,
          )
        )
          throw new CommandError(
            `${hole.type} ${hole.object} is blocked by wall ${wall.id} on ${level.name}`,
          )
      }
    }
  }
}
export const removeShaft = defineCommand({
  name: 'remove-shaft',
  summary: 'Remove a lift shaft by id and restore its slabs.',
  args: z.object({ id: z.string() }),
  run: (draft, args) => remove(draft, 'shafts', args.id),
})
export const removeRamp = defineCommand({
  name: 'remove-ramp',
  summary: 'Remove a ramp by id and restore its slabs.',
  args: z.object({ id: z.string() }),
  run: (draft, args) => remove(draft, 'ramps', args.id),
})
function remove(doc: HouseDocument, kind: 'shafts' | 'ramps', id: string) {
  for (const level of Object.values(doc.levels)) {
    if (kind === 'shafts' && level.shafts?.some((s) => s.id === id)) {
      level.shafts = level.shafts.filter((s) => s.id !== id)
      return { changed: [id], at: level.id }
    }
    if (kind === 'ramps' && level.ramps?.some((s) => s.id === id)) {
      level.ramps = level.ramps.filter((s) => s.id !== id)
      return { changed: [id], at: level.id }
    }
  }
  throw new CommandError(`no ${kind} entry ${id}`)
}
