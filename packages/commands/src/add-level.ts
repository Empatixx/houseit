import { levelsOf } from '@houseit/core/levels'
import { RoofSchema } from '@houseit/core/roof'
import { z } from 'zod'
import { allocateId } from './allocate-id'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { json } from './json-schema'
import { length } from './length-schema'
import { levelOf } from './resolve'

const STOREY = 2800

export const addLevel = defineCommand({
  name: 'add-level',
  summary: 'Add a storey, on top of the house or below it',
  args: z.object({
    name: z.string().trim().min(1),
    height: length().optional(),
    below: z.coerce.boolean().optional(),
  }),
  run: (draft, args) => {
    const stack = levelsOf(draft)
    const taken = stack.some((level) => level.name === args.name)
    if (taken) throw new CommandError(`add-level: there is already a storey called ${args.name}`)

    const height = args.height ?? stack.at(-1)?.height ?? STOREY
    const id = allocateId(draft.levels, 'l')

    if (args.below) {
      const lowest = stack[0]
      const elevation = (lowest?.elevation ?? 0) - height
      draft.levels[id] = { id, name: args.name, elevation, height }
      return { changed: [id] }
    }

    const top = stack.at(-1)
    draft.levels[id] = {
      id,
      name: args.name,
      elevation: (top?.elevation ?? 0) + (top?.height ?? 0),
      height,
    }
    return { changed: [id] }
  },
})

export const updateLevel = defineCommand({
  name: 'update-level',
  summary:
    'Change a storey: name, height, slab thickness, or --roofs JSON [{name,outline:[{x,y}],finish:membrane|planted|gravel,depth,parapet:{height,thickness,colour},fall:{percent,towards},drains:[{x,y,diameter}]}]. Heights and outline coordinates are millimetres; roofs stand on this storey’s slab',
  args: z.object({
    level: z.string().optional(),
    name: z.string().trim().min(1).optional(),
    height: length().optional(),
    slabThickness: length().optional(),
    roofs: json(z.array(RoofSchema)).optional(),
    storey: z.coerce.number().int().positive().optional(),
  }),
  run: (draft, args, open) => {
    const level = levelOf(draft, args.level ?? open, 'update-level')
    if (
      args.name === undefined &&
      args.height === undefined &&
      args.storey === undefined &&
      args.roofs === undefined &&
      args.slabThickness === undefined
    ) {
      throw new CommandError('update-level: say what to change — --name, --height or --storey')
    }
    const taken = levelsOf(draft).some((other) => other.id !== level && other.name === args.name)
    if (taken) throw new CommandError(`update-level: there is already a storey called ${args.name}`)

    const record = draft.levels[level]!
    if (args.slabThickness !== undefined) {
      if (args.slabThickness <= 0 || args.slabThickness >= (args.height ?? record.height))
        throw new CommandError(
          'update-level: slab thickness must be between zero and the storey height',
        )
      record.slabThickness = args.slabThickness
    }
    if (args.roofs !== undefined) record.roofs = args.roofs
    if (args.name !== undefined) record.name = args.name
    if (args.height !== undefined) {
      const lifted = args.height - record.height
      if (args.height <= (record.slabThickness ?? 250))
        throw new CommandError('update-level: storey height must exceed the slab thickness')
      const previousHeight = record.height
      record.height = args.height
      for (const wall of Object.values(draft.walls)) {
        if (wall.level === level && wall.height === previousHeight) wall.height = args.height
      }
      for (const other of levelsOf(draft)) {
        if (other.elevation > record.elevation) draft.levels[other.id]!.elevation += lifted
      }
    }
    if (args.storey !== undefined) {
      const stack = levelsOf(draft)
      if (args.storey > stack.length) {
        throw new CommandError(
          `update-level: this house has ${stack.length} storey(s), so there is no ${args.storey}th to move to`,
        )
      }
      const rest = stack.filter((other) => other.id !== level)
      rest.splice(args.storey - 1, 0, record)
      restack(draft, rest)
    }
    return { changed: [level] }
  },
})

function restack(draft: Parameters<typeof levelsOf>[0], order: { id: string }[]): void {
  let elevation = levelsOf(draft)[0]?.elevation ?? 0
  for (const storey of order) {
    const record = draft.levels[storey.id]!
    record.elevation = elevation
    elevation += record.height
  }
}

export const removeLevel = defineCommand({
  name: 'remove-level',
  summary: 'Take an empty storey back out of the house',
  args: z.object({
    level: z.string().optional(),
  }),
  run: (draft, args, open) => {
    const level = levelOf(draft, args.level ?? open, 'remove-level')
    const record = draft.levels[level]!
    if (levelsOf(draft).length === 1) {
      throw new CommandError('remove-level: a house stands on at least one storey')
    }
    if (
      Object.values(draft.levels).some((l) =>
        [...(l.shafts ?? []), ...(l.ramps ?? [])].some((c) => l.id === level || c.to === level),
      )
    )
      throw new CommandError('remove-level: remove its shafts and ramps first')
    if (record.columns?.length)
      throw new CommandError('remove-level: remove the structural columns first')
    const walls = Object.values(draft.walls).filter((wall) => wall.level === level).length
    if (walls > 0) {
      throw new CommandError(
        `remove-level: ${record.name} has ${walls} wall(s) on it — knock the rooms through first`,
      )
    }

    const height = record.height
    for (const other of levelsOf(draft)) {
      if (other.elevation > record.elevation) draft.levels[other.id]!.elevation -= height
    }
    delete draft.levels[level]
    return { changed: [level] }
  },
})
