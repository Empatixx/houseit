import type { HouseDocument } from '@houseit/core/document'
import { enablePatches, type Patch, produceWithPatches } from 'immer'
import { applyScript } from './apply-script'

// Immer ships patch support as an opt-in plugin; undo history depends on it.
enablePatches()

export type ScriptResult = {
  doc: HouseDocument
  /** Forward patches, for redo and for telling a viewer what changed. */
  patches: Patch[]
  /** Patches that take the new document back to the old one, for undo. */
  inversePatches: Patch[]
}

/**
 * Same transaction as `runScript`, but also reports the change as Immer patches.
 * Undo history is built from these rather than from document snapshots: a patch
 * pair is a fraction of the size and cannot drift from what actually happened.
 */
export function runScriptWithPatches(doc: HouseDocument, source: string): ScriptResult {
  const [next, patches, inversePatches] = produceWithPatches(doc, (draft) => {
    applyScript(draft, source)
  })
  return { doc: next, patches, inversePatches }
}
