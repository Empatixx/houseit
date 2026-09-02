import type { HouseDocument } from '@houseit/core/document'
import { produce } from 'immer'
import { applyScript } from './apply-script'
import type { ArgsOf, Output, TypedCommand } from './define-command'

/**
 * Runs one or more commands against a document and returns the result. Use
 * `runScriptWithPatches` where undo history is needed.
 */
export function runScript(doc: HouseDocument, source: string): HouseDocument {
  return produce(doc, (draft) => {
    applyScript(draft, source)
  })
}

/**
 * Runs a script for what it has to say rather than for what it does: the answers
 * of `describe` and `measure`, in order. Made for asking questions of a plan, but
 * a script that also changes the document is run all the same — the changes are
 * what the questions in it are answered against, and then thrown away.
 */
export function askScript(doc: HouseDocument, source: string): Output[] {
  let output: Output[] = []
  produce(doc, (draft) => {
    output = applyScript(draft, source)
  })
  return output
}

/** Runs one command on typed arguments and returns the document after it. */
export function applyCommand<C extends TypedCommand>(
  doc: HouseDocument,
  command: C,
  args: ArgsOf<C>,
): HouseDocument {
  return produce(doc, (draft) => {
    command.apply(draft, args)
  })
}
