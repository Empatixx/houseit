import type { ArgsOf, Touched, TypedCommand } from '@houseit/commands/define-command'
import {
  applyWithPatches,
  runScriptWithPatches,
  type ScriptResult,
} from '@houseit/commands/patches'
import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { levelsOf } from '@houseit/core/levels'
import { applyPatches, enablePatches, type Patch } from 'immer'
import { createStore } from 'zustand/vanilla'

enablePatches()

type HistoryEntry = { patches: Patch[]; inversePatches: Patch[] }

export type DocumentState = {
  doc: HouseDocument
  level: string
  setLevel: (level: string) => void
  past: HistoryEntry[]
  future: HistoryEntry[]
  canUndo: boolean
  canRedo: boolean
  exec: (source: string) => Touched
  apply: <C extends TypedCommand>(command: C, args: ArgsOf<C>) => Touched
  undo: () => void
  redo: () => void
  load: (doc: HouseDocument) => void
  reset: () => void
}

export function createDocumentStore(initial: HouseDocument | undefined = undefined) {
  const start = initial ?? createEmptyDocument()
  return createStore<DocumentState>()((set, get) => {
    const commit = (result: ScriptResult): Touched => {
      if (result.patches.length === 0) return result.touched
      const { past } = get()
      set({
        doc: result.doc,
        past: [...past, { patches: result.patches, inversePatches: result.inversePatches }],
        future: [],
        canUndo: true,
        canRedo: false,
      })
      return result.touched
    }

    return {
      doc: start,
      level: levelsOf(start)[0]!.id,
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,

      exec: (source) => commit(runScriptWithPatches(get().doc, source, get().level)),

      setLevel: (level) => {
        if (get().doc.levels[level]) set({ level })
      },

      apply: (command, args) => commit(applyWithPatches(get().doc, command, args, get().level)),

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
          level: levelsOf(doc)[0]!.id,
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
