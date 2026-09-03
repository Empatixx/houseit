import { useSelection } from '../store/selection'
import { useShell } from '../store/shell'
import { useDocument } from '../store/store'

/** Between the plan's edge and a card, and between one card and the next, in CSS pixels. */
export const GAP = 12
/** How wide the panel is. */
export const PANEL_WIDTH = 256
/** How wide the rail is folded to its icons, and pulled out to its names. */
export const RAIL_WIDTH = 48
export const RAIL_OPEN_WIDTH = 208

/**
 * Whether the panel is out. It shows what is picked, so it is out while
 * something is — or while the plan is empty and there is a floor to draw —
 * unless it has been folded away, which lasts until the next pick.
 */
export function usePanelShown(): boolean {
  const wanted = useShell((state) => state.panel)
  const picked = useSelection((state) => state.selected !== null)
  const empty = useDocument(
    (state) => !Object.values(state.doc.walls).some((wall) => wall.level === state.level),
  )
  return wanted && (picked || empty)
}

/** How far in from the plan's left edge the rail reaches, its gap included. */
export function useLeftEdge(): number {
  const rail = useShell((state) => state.rail)
  return GAP + (rail ? RAIL_OPEN_WIDTH : RAIL_WIDTH) + GAP
}

/** How far in from the plan's right edge the panel reaches while it is out, its gap included. */
export function useRightEdge(): number {
  const shown = usePanelShown()
  return shown ? GAP + PANEL_WIDTH + GAP : GAP
}
