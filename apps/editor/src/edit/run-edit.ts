import { sayError } from './notice'

/**
 * Runs one edit and says how it went: nothing when the plan took it, and the
 * command's own words as a toast when it did not. Every hand edit — a drag, a
 * key, a field in the panel — ends here.
 */
export function runEdit(change: () => unknown): boolean {
  try {
    change()
    return true
  } catch (error) {
    sayError(error instanceof Error ? error.message : String(error))
    return false
  }
}
