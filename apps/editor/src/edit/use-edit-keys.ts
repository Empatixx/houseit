import { useEffect } from 'react'
import { selectionStore } from '../store/selection'
import { documentStore } from '../store/store'
import { remove, turnBy } from './object-commands'

/**
 * Keys for what is picked: R turns it a quarter turn (shift, the other way),
 * the brackets turn it by fifteen degrees, Delete takes it out. Cmd or Ctrl
 * with Z undoes, with shift redoes. Nothing while typing into a field.
 */
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

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) documentStore.getState().redo()
        else documentStore.getState().undo()
        return
      }

      const selected = selectionStore.getState().selected
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

/** What each key turns the picked thing by, in degrees; capital R is shift and R. */
const TURNS: Record<string, number> = { r: 90, R: -90, ']': 15, '[': -15 }
