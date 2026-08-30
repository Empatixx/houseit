import type { HouseDocument } from '@houseit/core/document'
import type { Draft } from 'immer'
import type { z } from 'zod'
import { CommandError } from './command-error'
import { flagOf, type OptionSpec } from './option-spec'
import { parseArgv } from './parse-argv'

/** A command with its schema already consumed, so the registry holds one flat type. */
export type Command = {
  name: string
  summary: string
  options: OptionSpec[]
  execute: (draft: Draft<HouseDocument>, argv: string[]) => void
}

type Definition<Args extends z.ZodObject> = {
  name: string
  summary: string
  args: Args
  run: (draft: Draft<HouseDocument>, args: z.infer<Args>) => void
}

/** Unwraps optional/default/nullable wrappers to reach the value type underneath. */
function baseTypeOf(schema: z.ZodType): string {
  let current: { type: string; innerType?: z.ZodType } = schema.def
  while (
    (current.type === 'optional' || current.type === 'default' || current.type === 'nullable') &&
    current.innerType
  ) {
    current = current.innerType.def
  }
  return current.type
}

function optionsOf(args: z.ZodObject): OptionSpec[] {
  return Object.entries(args.shape).map(([name, field]) => {
    const schema = field as z.ZodType
    const wrapper = schema.def.type
    return {
      name,
      flag: flagOf(name),
      kind: baseTypeOf(schema) === 'boolean' ? 'boolean' : 'value',
      required: wrapper !== 'optional' && wrapper !== 'default',
    }
  })
}

/**
 * Declares a command once. The single declaration drives the CLI parser, the MCP
 * tool description, `--help` and runtime validation — there is no second place to
 * update when a command changes.
 */
export function defineCommand<Args extends z.ZodObject>(definition: Definition<Args>): Command {
  const options = optionsOf(definition.args)

  return {
    name: definition.name,
    summary: definition.summary,
    options,
    execute: (draft, argv) => {
      const values = parseArgv(definition.name, options, argv)
      const result = definition.args.safeParse(values)
      if (!result.success) {
        const detail = result.error.issues
          .map((issue) => `${issue.path.join('.') || '<argument>'}: ${issue.message}`)
          .join('; ')
        throw new CommandError(`${definition.name}: ${detail}`)
      }
      definition.run(draft, result.data as z.infer<Args>)
    },
  }
}
