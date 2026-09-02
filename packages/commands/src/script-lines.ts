import { parse as tokenize } from 'shell-quote'
import { CommandError } from './command-error'

/**
 * A script as the lines that do something: each one tokenised the way a shell
 * would, with blank lines and `#` comments already gone. The one reading of a
 * script, so that whoever runs it and whoever only wants to know what it asks
 * for read the same lines.
 */
export function scriptLines(source: string): string[][] {
  return source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map(argvOf)
    .filter((argv) => argv.length > 0)
}

function argvOf(line: string): string[] {
  return tokenize(line).map((token) => {
    if (typeof token !== 'string') {
      throw new CommandError(`shell syntax is not supported in commands: ${line}`)
    }
    return token
  })
}
