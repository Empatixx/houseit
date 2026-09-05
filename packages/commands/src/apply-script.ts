import type { HouseDocument } from '@houseit/core/document'
import type { Draft } from 'immer'
import { CommandError } from './command-error'
import { REGISTRY } from './registry'
import { scriptLines } from './script-lines'

/**
 * Applies a script to a draft. Blank lines and `#` comments are skipped. Throwing
 * part way through is what makes a script atomic — Immer discards the draft, so a
 * half-applied plan is not reachable.
 *
 * What comes back is everything the script touched, oldest first and each id
 * once. A script is one transaction and gets one answer: the rooms behind those
 * ids, read off the plan as it stands at the end, and one picture of them.
 */
export function applyScript(
  draft: Draft<HouseDocument>,
  source: string,
): { changed: string[]; shown: string[] } {
  const changed: string[] = []
  const shown: string[] = []
  const add = (into: string[], ids: string[]) => {
    for (const id of ids) if (!into.includes(id)) into.push(id)
  }
  for (const [name, ...argv] of scriptLines(source)) {
    if (!name) continue
    const command = REGISTRY.get(name)
    if (!command) {
      throw new CommandError(`Unknown command "${name}"`)
    }
    const said = command.execute(draft, argv)
    add(changed, said?.changed ?? [])
    add(shown, said?.shown ?? [])
  }
  return { changed, shown }
}
