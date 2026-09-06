import { levelsOf } from '@houseit/core/levels'
import { z } from 'zod'
import { allocateId } from './allocate-id'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
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
  summary: 'Change a storey: its name, or the height it is built at',
  args: z.object({
    level: z.string().optional(),
    name: z.string().trim().min(1).optional(),
    height: length().optional(),
    storey: z.coerce.number().int().positive().optional(),
  }),
  run: (draft, args, open) => {
    const level = levelOf(draft, args.level ?? open, 'update-level')
    if (args.name === undefined && args.height === undefined && args.storey === undefined) {
      throw new CommandError('update-level: say what to change — --name, --height or --storey')
    }
    const taken = levelsOf(draft).some((other) => other.id !== level && other.name === args.name)
    if (taken) throw new CommandError(`update-level: there is already a storey called ${args.name}`)

    const record = draft.levels[level]!
    if (args.name !== undefined) record.name = args.name
    if (args.height !== undefined) {
      const lifted = args.height - record.height
      record.height = args.height
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
