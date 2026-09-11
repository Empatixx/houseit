import type { ArgsOf, TypedCommand } from '@houseit/commands/define-command'
import { applyCommand } from '@houseit/commands/run'
import { previewStore } from '../store/preview'
import { documentStore } from '../store/store'

let last = ''

export function previewCommand<C extends TypedCommand>(command: C, args: ArgsOf<C>): void {
  const key = `${command.name}:${JSON.stringify(args)}`
  if (key === last) return
  last = key
  const { doc } = documentStore.getState()
  try {
    previewStore.getState().show(applyCommand(doc, command, args))
  } catch (error) {
    previewStore.getState().clear()
    previewStore.getState().refuse(error instanceof Error ? error.message : String(error))
  }
}

export function endPreview(): void {
  last = ''
  previewStore.getState().clear()
}
