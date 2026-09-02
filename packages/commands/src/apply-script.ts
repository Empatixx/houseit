import type { HouseDocument } from '@houseit/core/document'
import type { Draft } from 'immer'
import { CommandError } from './command-error'
import type { Output } from './define-command'
import { REGISTRY } from './registry'
import { scriptLines } from './script-lines'

/**
 * Applies a script to a draft. Blank lines and `#` comments are skipped. Throwing
 * part way through is what makes a script atomic — Immer discards the draft, so a
 * half-applied plan is not reachable.
 *
 * What comes back is what the lines that only looked had to say, in order. A
 * `describe` after an `add-room` sees the room, because it runs on the same
 * draft — the script is one transaction, and a look is part of it.
 */
export function applyScript(draft: Draft<HouseDocument>, source: string): Output[] {
  const output: Output[] = []
  for (const [name, ...argv] of scriptLines(source)) {
    if (!name) continue
    const command = REGISTRY.get(name)
    if (!command) {
      throw new CommandError(`Unknown command "${name}"`)
    }
    const said = command.execute(draft, argv)
    if (said !== undefined) output.push(said)
  }
  return output
}
