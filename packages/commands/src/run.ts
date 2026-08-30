import type { HouseDocument } from '@houseit/core/document'
import { produce } from 'immer'
import { applyScript } from './apply-script'

/**
 * Runs one or more commands against a document and returns the result. Use
 * `runScriptWithPatches` where undo history is needed.
 */
export function runScript(doc: HouseDocument, source: string): HouseDocument {
  return produce(doc, (draft) => {
    applyScript(draft, source)
  })
}
