import type { HouseDocument } from '@houseit/core/document'
import { produce } from 'immer'
import { type Answer, answerFor } from './answer'
import { applyScript } from './apply-script'
import type { ArgsOf, Touched, TypedCommand } from './define-command'

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
 * Runs a script for the answer it gives rather than for the document it leaves:
 * the rooms it touched, read back in full, and what is now wrong with the plan.
 *
 * The same answer the agent gets, put together by the same code — so a test that
 * reads a room reads what the agent would have been told, and not a second
 * opinion assembled for the occasion.
 */
export function askPlan(doc: HouseDocument, source: string, level?: string): Answer {
  let touched: Touched = { changed: [], shown: [] }
  const next = produce(doc, (draft) => {
    touched = applyScript(draft, source)
  })
  return answerFor(next, level ?? Object.keys(next.levels)[0]!, touched.changed, touched.shown)
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
