import { type Selection, selectionStore } from '../store/selection'
import { shellStore } from '../store/shell'

/**
 * Picks something by hand. What is picked is what the panel shows, so a click
 * that picks brings the panel out if it was folded away — always, so a click
 * on the plan never lands on nothing. The bridge picks things too, for
 * pictures, and goes to the selection directly: a picture is not a click.
 */
export function pick(selection: Selection | null) {
  selectionStore.getState().select(selection)
  if (selection) shellStore.getState().showPanel(true)
}
