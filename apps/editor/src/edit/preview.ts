import type { ArgsOf, TypedCommand } from '@houseit/commands/define-command'
import { applyCommand } from '@houseit/commands/run'
import { previewStore } from '../store/preview'
import { documentStore } from '../store/store'

/**
 * Shows what a command would do without doing it: run on a copy of the plan,
 * and the copy drawn until the pointer lets go. Refused, the plan is drawn as
 * it is, and the refusal kept for the moment of letting go.
 */
let last = ''

export function previewCommand<C extends TypedCommand>(command: C, args: ArgsOf<C>): void {
  // The pointer moves more often than the answer changes: the same ask again is the same answer.
  const key = `${command.name}:${JSON.stringify(args)}`
  if (key === last) return
  last = key
  const { doc } = documentStore.getState()
  try {
    previewStore.getState().show(applyCommand(doc, command, args))
  } catch (error) {
    previewStore.getState().show(doc)
    previewStore.getState().refuse(error instanceof Error ? error.message : String(error))
  }
}

export function endPreview(): void {
  last = ''
  previewStore.getState().clear()
}
