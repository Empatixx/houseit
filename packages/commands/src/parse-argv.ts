import { CommandError } from './command-error'
import type { OptionSpec } from './option-spec'

/**
 * A strict `--option value` parser. Written rather than taken from `node:util`
 * because commands execute inside the browser tab, where Node built-ins are
 * stubbed out silently and only fail at runtime. Knowing every option up front —
 * the schema already told us — makes it a couple of dozen lines with better
 * messages than a general-purpose parser would give.
 */
export function parseArgv(
  command: string,
  options: OptionSpec[],
  argv: string[],
): Record<string, unknown> {
  const specs = new Map(options.map((option) => [option.flag, option]))
  const values: Record<string, unknown> = {}

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!
    if (!token.startsWith('--')) {
      throw new CommandError(`${command}: unexpected argument "${token}"`)
    }

    const body = token.slice(2)
    const equals = body.indexOf('=')
    const name = equals === -1 ? body : body.slice(0, equals)
    const inline = equals === -1 ? undefined : body.slice(equals + 1)

    const spec = specs.get(name)
    if (!spec) {
      throw new CommandError(`${command}: unknown option --${name}`)
    }

    if (spec.kind === 'boolean') {
      if (inline !== undefined) {
        throw new CommandError(`${command}: --${name} is a flag and takes no value`)
      }
      values[spec.name] = true
      continue
    }

    let raw = inline
    if (raw === undefined) {
      index += 1
      raw = argv[index]
    }
    if (raw === undefined) {
      throw new CommandError(`${command}: --${name} needs a value`)
    }

    values[spec.name] = raw
  }

  return values
}
