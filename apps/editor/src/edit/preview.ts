import type { ArgsOf, TypedCommand } from '@houseit/commands/define-command'
import { applyCommand } from '@houseit/commands/run'
import { previewStore } from '../store/preview'
import { documentStore } from '../store/store'

let last = ''
let frame: number | undefined
let pending: (() => void) | undefined

export function schedulePreview(draw: () => void): void {
  pending = draw
  if (frame !== undefined) return
  frame = requestAnimationFrame(() => {
    frame = undefined
    const draw = pending
    pending = undefined
    draw?.()
  })
}

export function previewCommand<C extends TypedCommand>(command: C, args: ArgsOf<C>): void {
  const key = `${command.name}:${JSON.stringify(args)}`
  if (key === last) return
  last = key
  const { doc } = documentStore.getState()
  try {
    previewStore.getState().show(applyCommand(doc, command, args))
  } catch (error) {
    previewStore.getState().refuse(error instanceof Error ? error.message : String(error))
  }
}

export function endPreview(): void {
  if (frame !== undefined) cancelAnimationFrame(frame)
  frame = undefined
  pending = undefined
  last = ''
  previewStore.getState().clear()
}
