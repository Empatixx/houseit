import type { HouseDocument } from '@houseit/core/document'
import type { Draft } from 'immer'
import { CommandError } from './command-error'
import { REGISTRY } from './registry'
import { scriptLines } from './script-lines'

export function applyScript(
  draft: Draft<HouseDocument>,
  source: string,
  open?: string,
): { changed: string[]; shown: string[]; at?: string; notes?: string[] } {
  const changed: string[] = []
  const shown: string[] = []
  const notes: string[] = []
  let at: string | undefined
  const add = (into: string[], ids: string[]) => {
    for (const id of ids) if (!into.includes(id)) into.push(id)
  }
  for (const [name, ...argv] of scriptLines(source)) {
    if (!name) continue
    const command = REGISTRY.get(name)
    if (!command) {
      throw new CommandError(`Unknown command "${name}"`)
    }
    const said = command.execute(draft, argv, open)
    add(changed, said?.changed ?? [])
    add(shown, said?.shown ?? [])
    if (said?.at !== undefined) at = said.at
    notes.push(...(said?.notes ?? []))
  }
  return {
    changed,
    shown,
    ...(at === undefined ? {} : { at }),
    ...(notes.length === 0 ? {} : { notes }),
  }
}
