import { type Selection, selectionStore } from '../store/selection'
import { shellStore } from '../store/shell'

export function pick(selection: Selection | null) {
  selectionStore.getState().select(selection)
  if (selection) shellStore.getState().showPanel(true)
}
