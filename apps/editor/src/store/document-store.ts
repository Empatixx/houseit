import type { ArgsOf, Output, TypedCommand } from '@houseit/commands/define-command'
import {
  applyWithPatches,
  runScriptWithPatches,
  type ScriptResult,
} from '@houseit/commands/patches'
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
  /**
   * Runs a script of command lines, as the command bar and the bridge do.
   * Throws `CommandError` on bad input, leaving the document alone; what comes
   * back is what its `describe` and `measure` lines said.
   */
  exec: (source: string) => Output[]
  /**
   * Runs one command on typed arguments, as the editor does for a drag or a
   * key. The same checks, the same history entry — only no line of text in
   * between.
   */
  apply: <C extends TypedCommand>(command: C, args: ArgsOf<C>) => Output[]
  undo: () => void
  redo: () => void
  /**
   * Puts a stored plan in place with no history behind it. Opening a project
   * is not an edit, and undo belongs to a sitting rather than to a plan.
   */
  load: (doc: HouseDocument) => void
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
  return createStore<DocumentState>()((set, get) => {
    /** Takes a finished transaction into the document and the history, if it changed anything. */
    const commit = (result: ScriptResult): Output[] => {
      if (result.patches.length === 0) return result.output
      const { past } = get()
      set({
        doc: result.doc,
        past: [...past, { patches: result.patches, inversePatches: result.inversePatches }],
        future: [],
        canUndo: true,
        canRedo: false,
      })
      return result.output
    }

    return {
      doc: start,
      level: Object.keys(start.levels)[0]!,
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,

      exec: (source) => commit(runScriptWithPatches(get().doc, source)),

      apply: (command, args) => commit(applyWithPatches(get().doc, command, args)),

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

      load: (doc) =>
        set({
          doc,
          level: Object.keys(doc.levels)[0]!,
          past: [],
          future: [],
          canUndo: false,
          canRedo: false,
        }),

      reset: () => get().load(createEmptyDocument()),

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
    }
  })
}
