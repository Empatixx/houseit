import type { HouseDocument } from '@houseit/core/document'
import { enablePatches, type Patch, produceWithPatches } from 'immer'
import { applyScript } from './apply-script'
import type { ArgsOf, Touched, TypedCommand } from './define-command'

enablePatches()

export type ScriptResult = {
  doc: HouseDocument
  patches: Patch[]
  inversePatches: Patch[]
  touched: Touched
}

export function runScriptWithPatches(
  doc: HouseDocument,
  source: string,
  open?: string,
): ScriptResult {
  let touched: Touched = { changed: [], shown: [] }
  const [next, patches, inversePatches] = produceWithPatches(doc, (draft) => {
    touched = applyScript(draft, source, open)
  })
  return { doc: next, patches, inversePatches, touched }
}

export function applyWithPatches<C extends TypedCommand>(
  doc: HouseDocument,
  command: C,
  args: ArgsOf<C>,
  open?: string,
): ScriptResult {
  let touched: Touched = { changed: [], shown: [] }
  const [next, patches, inversePatches] = produceWithPatches(doc, (draft) => {
    const said = command.apply(draft, args, open)
    touched = {
      changed: said?.changed ?? [],
      shown: said?.shown ?? [],
      ...(said?.at === undefined ? {} : { at: said.at }),
      ...(said?.notes === undefined ? {} : { notes: said.notes }),
    }
  })
  return { doc: next, patches, inversePatches, touched }
}
