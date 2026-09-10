import { useSelection } from '../store/selection'
import { useShell } from '../store/shell'

export const GAP = 12
export const PANEL_WIDTH = 256
export const RAIL_WIDTH = 48
export const RAIL_OPEN_WIDTH = 208
export const RAIL_PANEL_WIDTH = 272

export function usePanelShown(): boolean {
  const wanted = useShell((state) => state.panel)
  const picked = useSelection((state) => state.selected !== null)
  return wanted && picked
}

export function useLeftEdge(): number {
  const rail = useShell((state) => state.rail)
  const tab = useShell((state) => state.tab)
  const panel = tab === null ? 0 : RAIL_PANEL_WIDTH + GAP
  return GAP + (rail ? RAIL_OPEN_WIDTH : RAIL_WIDTH) + GAP + panel
}

export function useRightEdge(): number {
  const shown = usePanelShown()
  return shown ? GAP + PANEL_WIDTH + GAP : GAP
}
