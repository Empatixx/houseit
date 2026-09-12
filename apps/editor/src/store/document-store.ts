import type { ArgsOf, Touched, TypedCommand } from '@houseit/commands/define-command'
import { createEmptyDocument, type HouseDocument } from '@houseit/core/document'
import { levelsOf } from '@houseit/core/levels'
import { createStore } from 'zustand/vanilla'
import { FragmentAuthoring } from '../engine/fragment-authoring'

export type DocumentState = {
  doc: HouseDocument
  authoring: FragmentAuthoring
  level: string
  setLevel: (level: string) => void
  past: number[]
  future: number[]
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
  const authoring = new FragmentAuthoring(start)
  return createStore<DocumentState>()((set, get) => {
    const publish = () => {
      const { authoring, doc, level } = get()
      if (doc === authoring.document) return
      set({
        doc: authoring.document,
        ...authoring.history,
        level: authoring.document.levels[level] ? level : levelsOf(authoring.document)[0]!.id,
      })
    }
    return {
      doc: authoring.document,
      authoring,
      level: levelsOf(start)[0]!.id,
      ...authoring.history,
      setLevel: (level) => {
        if (get().doc.levels[level]) set({ level })
      },
      exec: (source) => {
        const touched = get().authoring.exec(source, get().level)
        publish()
        return touched
      },
      apply: (command, args) => {
        const touched = get().authoring.apply(command, args, get().level)
        publish()
        return touched
      },
      undo: () => {
        get().authoring.undo()
        publish()
      },
      redo: () => {
        get().authoring.redo()
        publish()
      },
      load: (doc) => {
        const authoring = new FragmentAuthoring(doc)
        get().authoring.dispose()
        set({
          authoring,
          doc: authoring.document,
          level: levelsOf(doc)[0]!.id,
          ...authoring.history,
        })
      },
      reset: () => get().load(createEmptyDocument()),
    }
  })
}
