import { RampSchema, ShaftSchema } from '@houseit/core/connections'
import type { HouseDocument } from '@houseit/core/document'
import { boxOf, clashes, wallBox } from '@houseit/geometry/boxes'
import { connectionHoles } from '@houseit/geometry/connections'
import { z } from 'zod'
import { allocateId } from './allocate-id'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { length } from './length-schema'
import { levelOf } from './resolve'

const position = { x: length(), y: length(), width: length() }
export const addShaft = defineCommand({
  name: 'add-shaft',
  summary:
    'Hold a lift shaft open from --level through --to (storey name or id). x,y is the centre of the clear shaft, in mm; enclose it with rooms and walls.',
  args: z.object({ ...position, depth: length(), to: z.string(), level: z.string().optional() }),
  run: (draft, args, open) => {
    const level = levelOf(draft, args.level ?? open, 'add-shaft')
    const to = levelOf(draft, args.to, 'add-shaft')
    if (draft.levels[to]!.elevation <= draft.levels[level]!.elevation)
      throw new CommandError('shaft must reach a higher storey')
    const all = Object.fromEntries(
      Object.values(draft.levels).flatMap((l) => (l.shafts ?? []).map((s) => [s.id, s])),
    )
    const shaft = ShaftSchema.parse({ ...args, to, id: allocateId(all, 'shaft') })
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
    'A ramp from --level up to --to. x,y is the centre of its lower end; --direction points uphill, --length is the horizontal run, all dimensions in mm.',
  args: z.object({
    ...position,
    length: length(),
    direction: RampSchema.shape.direction,
    thickness: length(),
    colour: RampSchema.shape.colour,
    to: z.string(),
    level: z.string().optional(),
  }),
  run: (draft, args, open) => {
    const level = levelOf(draft, args.level ?? open, 'add-ramp')
    const to = levelOf(draft, args.to, 'add-ramp')
    if (draft.levels[to]!.elevation <= draft.levels[level]!.elevation)
      throw new CommandError('ramp must reach a higher storey')
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
