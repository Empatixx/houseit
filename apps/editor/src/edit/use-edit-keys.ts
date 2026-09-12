import { roomsOf } from '@houseit/geometry/rooms'
import { useEffect } from 'react'
import { activeTools } from '../engine/native-tools'
import { drawStore } from '../store/draw'
import { engineViewStore } from '../store/engine-view'
import { selectionStore } from '../store/selection'
import { documentStore } from '../store/store'
import { toolStore } from '../store/tool'
import { cancelDrawing, finishDrawing } from './draw-commands'
import { remove, turnBy } from './object-commands'
import { removeOpening } from './opening-commands'
import { knockThroughToBiggest, removeStub } from './wall-commands'

export function useEditKeys(): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return
      }

      if (event.key === 'Escape' && engineViewStore.getState().measure !== 'none') {
        activeTools?.measure.cancelCreation()
        engineViewStore.getState().configure({ measure: 'none' })
        return
      }
      if (event.key === 'Escape') {
        cancelDrawing()
        toolStore.getState().arm(null)
        selectionStore.getState().select(null)
        return
      }
      if (event.key === 'Enter' && drawStore.getState().points.length > 0) {
        event.preventDefault()
        finishDrawing()
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) documentStore.getState().redo()
        else documentStore.getState().undo()
        return
      }

      const selected = selectionStore.getState().selected
      if (selected?.kind === 'opening') {
        const opening = documentStore.getState().doc.openings[selected.id]
        if (opening && (event.key === 'Delete' || event.key === 'Backspace')) {
          event.preventDefault()
          removeOpening(opening)
          selectionStore.getState().select(null)
        }
        return
      }
      if (selected?.kind === 'wall') {
        const wall = documentStore.getState().doc.walls[selected.id]
        if (wall && (event.key === 'Delete' || event.key === 'Backspace')) {
          event.preventDefault()
          if (removeStub(wall)) selectionStore.getState().select(null)
        }
        return
      }
      if (selected?.kind === 'room') {
        const room = roomsOf(documentStore.getState().doc, documentStore.getState().level).find(
          (candidate) => candidate.id === selected.id,
        )
        if (room && (event.key === 'Delete' || event.key === 'Backspace')) {
          event.preventDefault()
          if (knockThroughToBiggest(room)) selectionStore.getState().select(null)
        }
        return
      }
      if (selected?.kind !== 'object') return
      const object = documentStore.getState().doc.objects[selected.id]
      if (!object) return

      const turn = TURNS[event.key]
      if (turn !== undefined) {
        event.preventDefault()
        turnBy(object, turn)
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        remove(object)
        selectionStore.getState().select(null)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

const TURNS: Record<string, number> = { r: 90, R: -90, ']': 15, '[': -15 }
