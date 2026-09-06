import type { HouseDocument } from '@houseit/core/document'
import { levelsOf } from '@houseit/core/levels'
import { produce } from 'immer'
import { type Answer, answerFor } from './answer'
import { applyScript } from './apply-script'
import type { ArgsOf, Touched, TypedCommand } from './define-command'

export function runScript(doc: HouseDocument, source: string, open?: string): HouseDocument {
  return produce(doc, (draft) => {
    applyScript(draft, source, open)
  })
}

export function askPlan(doc: HouseDocument, source: string, open?: string): Answer {
  let touched: Touched = { changed: [], shown: [] }
  const next = produce(doc, (draft) => {
    touched = applyScript(draft, source, open)
  })
  return answerFor(
    next,
    open ?? levelsOf(next)[0]!.id,
    touched.changed,
    touched.shown,
    touched.at,
    touched.notes,
  )
}

export function applyCommand<C extends TypedCommand>(
  doc: HouseDocument,
  command: C,
  args: ArgsOf<C>,
): HouseDocument {
  return produce(doc, (draft) => {
    command.apply(draft, args)
  })
}
