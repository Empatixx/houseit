import { noticeStore } from '../store/notice'

/**
 * Runs one edit and says how it went: the notice is cleared when the plan
 * took it and carries the command's own words when it did not. Every hand
 * edit — a drag, a key, a field in the panel — ends here.
 */
export function runEdit(change: () => unknown): boolean {
  try {
    change()
    noticeStore.getState().clear()
    return true
  } catch (error) {
    noticeStore.getState().say(error instanceof Error ? error.message : String(error))
    return false
  }
}
