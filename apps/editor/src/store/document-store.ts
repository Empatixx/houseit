import { runScriptWithPatches } from '@houseit/commands/patches'
import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { applyPatches, enablePatches, type Patch } from 'immer'
import { createStore } from 'zustand/vanilla'

// Idempotent, and required before applyPatches runs in this bundle.
enablePatches()

type HistoryEntry = { patches: Patch[]; inversePatches: Patch[] }

export type DocumentState = {
  doc: HouseDocument
  /** The level currently being edited. */
  level: string
  past: HistoryEntry[]
  future: HistoryEntry[]
  canUndo: boolean
  canRedo: boolean
  /** Applies a script. Throws `CommandError` on bad input, leaving the document alone. */
  exec: (source: string) => void
  undo: () => void
  redo: () => void
  /** Starts again from nothing, history and all. */
  reset: () => void
}

/**
 * History is a stack of Immer patch pairs rather than document snapshots: far
 * smaller, and it cannot drift from what the commands actually did. One script is
 * one history entry, so a script that draws four rooms undoes in a single step.
 */
export function createDocumentStore(initial: HouseDocument | undefined = undefined) {
  const start = initial ?? createEmptyDocument()
  return createStore<DocumentState>()((set, get) => ({
    doc: start,
    level: Object.keys(start.levels)[0]!,
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,

    exec: (source) => {
      const { doc, past } = get()
      const result = runScriptWithPatches(doc, source)
      if (result.patches.length === 0) return

      const nextPast = [...past, { patches: result.patches, inversePatches: result.inversePatches }]
      set({
        doc: result.doc,
        past: nextPast,
        future: [],
        canUndo: true,
        canRedo: false,
      })
    },

    undo: () => {
      const { doc, past, future } = get()
      const entry = past.at(-1)
      if (!entry) return

      const nextPast = past.slice(0, -1)
      set({
        doc: applyPatches(doc, entry.inversePatches),
        past: nextPast,
        future: [...future, entry],
        canUndo: nextPast.length > 0,
        canRedo: true,
      })
    },

    reset: () => {
      const empty = createEmptyDocument()
      set({
        doc: empty,
        level: Object.keys(empty.levels)[0]!,
        past: [],
        future: [],
        canUndo: false,
        canRedo: false,
      })
    },

    redo: () => {
      const { doc, past, future } = get()
      const entry = future.at(-1)
      if (!entry) return

      const nextFuture = future.slice(0, -1)
      set({
        doc: applyPatches(doc, entry.patches),
        past: [...past, entry],
        future: nextFuture,
        canUndo: true,
        canRedo: nextFuture.length > 0,
      })
    },
  }))
}
