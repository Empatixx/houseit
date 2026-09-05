import type { HouseDocument } from '@houseit/core/document'
import { enablePatches, type Patch, produceWithPatches } from 'immer'
import { applyScript } from './apply-script'
import type { ArgsOf, Touched, TypedCommand } from './define-command'

// Immer ships patch support as an opt-in plugin; undo history depends on it.
enablePatches()

export type ScriptResult = {
  doc: HouseDocument
  /** Forward patches, for redo and for telling a viewer what changed. */
  patches: Patch[]
  /** Patches that take the new document back to the old one, for undo. */
  inversePatches: Patch[]
  /** What the script touched, which is what its answer will be about. */
  touched: Touched
}

/**
 * Same transaction as `runScript`, but also reports the change as Immer patches.
 * Undo history is built from these rather than from document snapshots: a patch
 * pair is a fraction of the size and cannot drift from what actually happened.
 */
export function runScriptWithPatches(doc: HouseDocument, source: string): ScriptResult {
  let touched: Touched = { changed: [], shown: [] }
  const [next, patches, inversePatches] = produceWithPatches(doc, (draft) => {
    touched = applyScript(draft, source)
  })
  return { doc: next, patches, inversePatches, touched }
}

/**
 * One command on typed arguments, as a transaction with patches — what the
 * editor runs when a drag or a key has been worked out into a command. The
 * same history entry a script makes, so an undo does not care which door the
 * change came in by.
 */
export function applyWithPatches<C extends TypedCommand>(
  doc: HouseDocument,
  command: C,
  args: ArgsOf<C>,
): ScriptResult {
  let touched: Touched = { changed: [], shown: [] }
  const [next, patches, inversePatches] = produceWithPatches(doc, (draft) => {
    const said = command.apply(draft, args)
    touched = { changed: said?.changed ?? [], shown: said?.shown ?? [] }
  })
  return { doc: next, patches, inversePatches, touched }
}
