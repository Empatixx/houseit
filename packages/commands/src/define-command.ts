import type { HouseDocument } from '@houseit/core/document'
import type { Draft } from 'immer'
import type { z } from 'zod'
import { CommandError } from './command-error'
import { flagOf, type OptionSpec } from './option-spec'
import { parseArgv } from './parse-argv'

/**
 * What a command has to say for itself, beyond what it did to the document.
 *
 * Most commands say nothing: the plan afterwards is the answer. The ones that
 * only look — `describe`, `measure` — answer with this, and it has to be plain
 * data, because it leaves the transaction it was made in and crosses to whoever
 * asked as JSON. Nothing from the draft may be handed back as it is.
 */
export type Output = Record<string, unknown>

/**
 * A command as the command line and the agent see it: a name, a summary, the
 * options it takes, and a way to run it from words. The registry holds these.
 */
export type AnyCommand = {
  name: string
  summary: string
  options: OptionSpec[]
  /** Runs the command from its words on a line, as the terminal and the MCP tool do. */
  execute: (draft: Draft<HouseDocument>, argv: string[]) => Output | undefined
}

/**
 * The same command with its arguments typed, for code that already knows what
 * it wants — the editor turning a drag into a move — and has no business
 * writing a line of text for a parser to read straight back.
 */
export type Command<Args extends z.ZodObject> = AnyCommand & {
  args: Args
  /** Runs the command on typed arguments. Checked by the same schema as the words are. */
  apply(draft: Draft<HouseDocument>, args: z.input<Args>): Output | undefined
}

/** Any typed command, whatever it takes — for code that is handed commands as values. */
export type TypedCommand = Command<z.ZodObject>

/** What a typed command takes, as it may be given: `--along 0.5` may be a number here. */
export type ArgsOf<C extends TypedCommand> = C extends Command<infer Args> ? z.input<Args> : never

type Definition<Args extends z.ZodObject> = {
  name: string
  summary: string
  args: Args
  /** Does the work; a command that only looks answers with its output. */
  // biome-ignore lint/suspicious/noConfusingVoidType: a command that changes the plan returns nothing at all
  run: (draft: Draft<HouseDocument>, args: z.infer<Args>) => Output | void
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
 * tool description, `--help`, runtime validation and the typed call the editor
 * makes — there is no second place to update when a command changes, and no
 * way in that skips the checks.
 */
export function defineCommand<Args extends z.ZodObject>(
  definition: Definition<Args>,
): Command<Args> {
  const options = optionsOf(definition.args)

  const apply = (draft: Draft<HouseDocument>, args: z.input<Args>): Output | undefined => {
    const result = definition.args.safeParse(args)
    if (!result.success) {
      const detail = result.error.issues
        .map((issue) => `${issue.path.join('.') || '<argument>'}: ${issue.message}`)
        .join('; ')
      throw new CommandError(`${definition.name}: ${detail}`)
    }
    return definition.run(draft, result.data as z.infer<Args>) as Output | undefined
  }

  return {
    name: definition.name,
    summary: definition.summary,
    options,
    args: definition.args,
    apply,
    execute: (draft, argv) =>
      apply(draft, parseArgv(definition.name, options, argv) as z.input<Args>),
  }
}
