import type { HouseDocument } from '@houseit/core/document'
import { produce } from 'immer'
import { applyScript } from './apply-script'
import type { ArgsOf, TypedCommand } from './define-command'

export function runScript(doc: HouseDocument, source: string, open?: string): HouseDocument {
  return produce(doc, (draft) => {
    applyScript(draft, source, open)
  })
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
