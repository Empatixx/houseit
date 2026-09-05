import { levelsOf } from '@houseit/core/levels'
import { z } from 'zod'
import { allocateId } from './allocate-id'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { length } from './length-schema'
import { levelOf } from './resolve'

/** Floor to floor, unless said otherwise: the height a storey is built at. */
const STOREY = 2800

/**
 * Adds a storey.
 *
 * On top of the house by default, which is what adding a storey means: its
 * floor sits at the top of the wall of the one below. `--below` puts it
 * underneath instead, which is a cellar, and everything above it moves up by
 * its height — because a storey is a real height above the ground and not a
 * label, and inserting one lifts the house.
 *
 * It is a fourth noun rather than an option on the others because a storey is
 * a thing you can point at: it has a name, a height, and rooms that belong to
 * it. Everything else already takes `--level`, and now there is something to
 * give it.
 */
export const addLevel = defineCommand({
  name: 'add-level',
  summary: 'Add a storey, on top of the house or below it',
  args: z.object({
    name: z.string().trim().min(1),
    /** Floor to floor. The walls drawn on it stand this high. */
    height: length().optional(),
    /** Under the house rather than on top of it: a cellar. */
    below: z.coerce.boolean().optional(),
  }),
  run: (draft, args) => {
    const stack = levelsOf(draft)
    const taken = stack.some((level) => level.name === args.name)
    if (taken) throw new CommandError(`add-level: there is already a storey called ${args.name}`)

    const height = args.height ?? stack.at(-1)?.height ?? STOREY
    const id = allocateId(draft.levels, 'l')

    if (args.below) {
      // A cellar goes under the lowest floor, and the house stands on it.
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

/**
 * Changes a storey: its name, how high it is built, or where in the house it is.
 *
 * A storey made taller lifts everything above it, since a floor sits on the
 * walls under it. That is also why the height is not a decoration: it is what
 * decides how many risers a staircase climbing out of this storey has.
 *
 * `--storey` moves it up or down the stack, counting the lowest as the first.
 * Everything on a storey goes with it — the rooms belong to the storey, not to
 * the height — so this swaps two floors of a house over rather than shuffling
 * a label.
 */
export const updateLevel = defineCommand({
  name: 'update-level',
  summary: 'Change a storey: its name, or the height it is built at',
  args: z.object({
    /** The storey, by name or by id. Left out, the only one there is. */
    level: z.string().optional(),
    name: z.string().trim().min(1).optional(),
    height: length().optional(),
    /** Where in the house it stands, counting the lowest as the first. */
    storey: z.coerce.number().int().positive().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'update-level')
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
      // Everything above stands on this storey's walls, so it goes up with them.
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

/**
 * Stands the storeys back up in the order given: each floor on the walls of the
 * one under it, from wherever the lowest one starts. Elevation is the order, so
 * changing the order is changing the elevations and nothing else — what stands
 * on a storey belongs to the storey and comes along.
 */
function restack(draft: Parameters<typeof levelsOf>[0], order: { id: string }[]): void {
  let elevation = levelsOf(draft)[0]?.elevation ?? 0
  for (const storey of order) {
    const record = draft.levels[storey.id]!
    record.elevation = elevation
    elevation += record.height
  }
}

/**
 * Takes a storey out. Only an empty one: a storey with walls on it is a floor
 * of the house, and losing it silently would lose the rooms with it.
 */
export const removeLevel = defineCommand({
  name: 'remove-level',
  summary: 'Take an empty storey back out of the house',
  args: z.object({
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'remove-level')
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

    // The house closes up over the gap: a storey taken out of the middle would
    // otherwise leave the ones above it floating a storey too high.
    const height = record.height
    for (const other of levelsOf(draft)) {
      if (other.elevation > record.elevation) draft.levels[other.id]!.elevation -= height
    }
    delete draft.levels[level]
    return { changed: [level] }
  },
})
