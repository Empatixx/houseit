import { activeTools } from '../engine/native-tools'
import { engineViewStore } from '../store/engine-view'
import { type Selection, selectionStore } from '../store/selection'
import { shellStore } from '../store/shell'

export function pick(selection: Selection | null) {
  if (engineViewStore.getState().measure !== 'none') return
  if (selection && activeTools) {
    activeTools.select(selection)
    return
  }
  selectionStore.getState().select(selection)
  if (selection) shellStore.getState().showPanel(true)
}
