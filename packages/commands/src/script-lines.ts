import { parse as tokenize } from 'shell-quote'
import { CommandError } from './command-error'

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
