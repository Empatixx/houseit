import type { Site } from '@houseit/core/document'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

export type SiteDialogRequest = { kind: 'create'; name: string } | { kind: 'attach' }

export type SiteDialogState = {
  request: SiteDialogRequest | null
  pending: Site | null
  openFor: (request: SiteDialogRequest, initial?: Site) => void
  select: (site: Site | null) => void
  close: () => void
}

export function createSiteDialogStore() {
  return createStore<SiteDialogState>()((set) => ({
    request: null,
    pending: null,
    openFor: (request, initial) => set({ request, pending: initial ?? null }),
    select: (pending) => set({ pending }),
    close: () => set({ request: null, pending: null }),
  }))
}

export const siteDialogStore = createSiteDialogStore()

export function useSiteDialog<T>(selector: (state: SiteDialogState) => T): T {
  return useStore(siteDialogStore, selector)
}
