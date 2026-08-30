import type { HouseDocument } from '@houseit/core/document'
import type { Draft } from 'immer'
import { parse as tokenize } from 'shell-quote'
import { CommandError } from './command-error'
import { REGISTRY } from './registry'

function argvOf(line: string): string[] {
  return tokenize(line).map((token) => {
    if (typeof token !== 'string') {
      throw new CommandError(`shell syntax is not supported in commands: ${line}`)
    }
    return token
  })
}

/**
 * Applies a script to a draft. Blank lines and `#` comments are skipped. Throwing
 * part way through is what makes a script atomic — Immer discards the draft, so a
 * half-applied plan is not reachable.
 */
export function applyScript(draft: Draft<HouseDocument>, source: string): void {
  const lines = source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))

  for (const line of lines) {
    const [name, ...argv] = argvOf(line)
    if (!name) continue
    const command = REGISTRY.get(name)
    if (!command) {
      throw new CommandError(`Unknown command "${name}"`)
    }
    command.execute(draft, argv)
  }
}
