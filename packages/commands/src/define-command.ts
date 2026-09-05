import type { HouseDocument } from '@houseit/core/document'
import type { Draft } from 'immer'
import type { z } from 'zod'
import { CommandError } from './command-error'
import { flagOf, type OptionSpec } from './option-spec'
import { parseArgv } from './parse-argv'

/**
 * What a command touched: the ids of what it made or changed — a room, an
 * opening, a thing.
 *
 * This is all a command says for itself, and it is what the answer is built
 * from. There is no command for looking: the plan is read back through the ids
 * a change reports, so every command answers with the rooms it touched, their
 * free stretches of wall and whatever is now wrong with the plan. Ask nothing,
 * and you are told anyway.
 */
/** What a whole script touched, gathered from every command in it. */
export type Touched = { changed: string[]; shown: string[]; at?: string }

export type Change = {
  /** Ids of what it made or changed. */
  changed?: string[]
  /** Ids it changed nothing about but wants the answer to cover: `get-plan`. */
  shown?: string[]
  /**
   * The storey it was about, where that is not simply where its rooms are —
   * `get-plan --level půda` on a storey nobody has drawn on yet has no rooms to
   * say it from, and is still about the loft.
   */
  at?: string
}

/**
 * A command as the command line and the agent see it: a name, a summary, the
 * options it takes, and a way to run it from words. The registry holds these.
 */
export type AnyCommand = {
  name: string
  summary: string
  options: OptionSpec[]
  /**
   * Runs the command from its words on a line, as the terminal and the MCP tool
   * do. `open` is the storey the plan is being looked at, which is what a
   * command means when it names no storey of its own.
   */
  execute: (draft: Draft<HouseDocument>, argv: string[], open?: string) => Change | undefined
}

/**
 * The same command with its arguments typed, for code that already knows what
 * it wants — the editor turning a drag into a move — and has no business
 * writing a line of text for a parser to read straight back.
 */
export type Command<Args extends z.ZodObject> = AnyCommand & {
  args: Args
  /** Runs the command on typed arguments. Checked by the same schema as the words are. */
  apply(draft: Draft<HouseDocument>, args: z.input<Args>, open?: string): Change | undefined
}

/** Any typed command, whatever it takes — for code that is handed commands as values. */
export type TypedCommand = Command<z.ZodObject>

/** What a typed command takes, as it may be given: `--along 0.5` may be a number here. */
export type ArgsOf<C extends TypedCommand> = C extends Command<infer Args> ? z.input<Args> : never

type Definition<Args extends z.ZodObject> = {
  name: string
  summary: string
  args: Args
  /**
   * Does the work, and says what it touched. `open` is the storey being looked
   * at — what a command that names no storey is talking about.
   */
  // biome-ignore lint/suspicious/noConfusingVoidType: a command may touch nothing nameable
  run: (draft: Draft<HouseDocument>, args: z.infer<Args>, open?: string) => Change | void
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
    return definition.run(draft, result.data as z.infer<Args>, open) as Change | undefined
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
