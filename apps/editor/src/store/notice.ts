import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

type NoticeState = {
  /** What went wrong with the last thing done on the plan, until the next thing. */
  message: string | null
  say: (message: string) => void
  clear: () => void
}

/**
 * A drag that ends in a command the plan refuses has to say so somewhere. The
 * command bar says it for what was typed; this says it for what was done.
 */
export const noticeStore = createStore<NoticeState>()((set) => ({
  message: null,
  say: (message) => set({ message }),
  clear: () => set({ message: null }),
}))

export function useNotice<T>(selector: (state: NoticeState) => T): T {
  return useStore(noticeStore, selector)
}
