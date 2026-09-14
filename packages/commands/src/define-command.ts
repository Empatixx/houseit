import type { HouseDocument } from '@houseit/core/document'
import type { Draft } from 'immer'
import type { z } from 'zod'
import { CommandError } from './command-error'
import { flagOf, type OptionSpec } from './option-spec'
import { parseArgv } from './parse-argv'
import { rebindAll } from './rebind'

export type Touched = { changed: string[]; shown: string[]; at?: string; notes?: string[] }

export type Change = {
  changed?: string[]
  shown?: string[]
  at?: string
  notes?: string[]
}

export type AnyCommand = {
  name: string
  summary: string
  options: OptionSpec[]
  execute: (draft: Draft<HouseDocument>, argv: string[], open?: string) => Change | undefined
}

export type Command<Args extends z.ZodObject> = AnyCommand & {
  args: Args
  apply(draft: Draft<HouseDocument>, args: z.input<Args>, open?: string): Change | undefined
}

export type TypedCommand = Command<z.ZodObject>

export type ArgsOf<C extends TypedCommand> = C extends Command<infer Args> ? z.input<Args> : never

type Definition<Args extends z.ZodObject> = {
  name: string
  summary: string
  readOnly?: boolean
  args: Args
  // biome-ignore lint/suspicious/noConfusingVoidType: a command may touch nothing nameable
  run: (draft: Draft<HouseDocument>, args: z.infer<Args>, open?: string) => Change | void
}

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

export function defineCommand<Args extends z.ZodObject>(
  definition: Definition<Args>,
): Command<Args> {
  const options = optionsOf(definition.args)

  const apply = (
    draft: Draft<HouseDocument>,
    args: z.input<Args>,
    open?: string,
  ): Change | undefined => {
    const result = definition.args.safeParse(args)
    if (!result.success) {
      const detail = result.error.issues
        .map((issue) => `${issue.path.join('.') || '<argument>'}: ${issue.message}`)
        .join('; ')
      throw new CommandError(`${definition.name}: ${detail}`)
    }
    const change = definition.run(draft, result.data as z.infer<Args>, open) as Change | undefined
    if (!definition.readOnly) rebindAll(draft)
    return change
  }

  return {
    name: definition.name,
    summary: definition.summary,
    options,
    args: definition.args,
    apply,
    execute: (draft, argv, open) =>
      apply(draft, parseArgv(definition.name, options, argv) as z.input<Args>, open),
  }
}
