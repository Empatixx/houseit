import type { ArgsOf, TypedCommand } from '@houseit/commands/define-command'
import { applyCommand } from '@houseit/commands/run'
import { previewWallCommand } from '@houseit/commands/wall-preview'
import type { HouseDocument } from '@houseit/core/document'

type Result = { value: number; doc: HouseDocument }
let cached: { source: HouseDocument; key: string; result: Result } | undefined

export function constrainWallEdit<C extends TypedCommand>(
  source: HouseDocument,
  command: C,
  argsAt: (value: number) => ArgsOf<C>,
  from: number,
  to: number,
  stops: number[] = [],
  preview = false,
) {
  const key = JSON.stringify([command.name, argsAt(from), argsAt(to), stops, preview])
  const trial = (value: number): Result | undefined => {
    try {
      const apply = preview ? previewWallCommand : applyCommand
      return { value, doc: apply(source, command, argsAt(value)) }
    } catch {
      return undefined
    }
  }
  let result = cached?.source === source && cached.key === key ? cached.result : undefined
  if (!result) {
    result = from === to ? { value: from, doc: source } : trial(to)
    if (!result) {
      result = { value: from, doc: source }
      let low = 0,
        high = Math.ceil(Math.abs(to - from))
      const direction = Math.sign(to - from)
      const candidates = [...new Set(stops)]
        .filter((value) => (value - from) * direction > 0 && (to - value) * direction >= 0)
        .sort((a, b) => direction * (b - a))
      for (const value of candidates) {
        const candidate = trial(value)
        if (!candidate) continue
        result = candidate
        low = Math.abs(value - from)
        break
      }
      while (high - low > 1) {
        const middle = Math.floor((low + high) / 2)
        const candidate = trial(from + direction * middle)
        if (candidate) {
          low = middle
          result = candidate
        } else high = middle
      }
    }
    cached = { source, key, result }
  }
  return { ...result, args: argsAt(result.value), changed: result.value !== from }
}
