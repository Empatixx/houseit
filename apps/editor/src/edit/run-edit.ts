import { sayError } from './notice'

export function runEdit(change: () => unknown): boolean {
  try {
    change()
    return true
  } catch (error) {
    sayError(error instanceof Error ? error.message : String(error))
    return false
  }
}
