import { useSelection } from '../store/selection'
import { useShell } from '../store/shell'

export const GAP = 12
export const PANEL_WIDTH = 256
export const RAIL_WIDTH = 48
export const RAIL_OPEN_WIDTH = 208

export function usePanelShown(): boolean {
  const wanted = useShell((state) => state.panel)
  const picked = useSelection((state) => state.selected !== null)
  return wanted && picked
}

export function useLeftEdge(): number {
  const rail = useShell((state) => state.rail)
  return GAP + (rail ? RAIL_OPEN_WIDTH : RAIL_WIDTH) + GAP
}

export function useRightEdge(): number {
  const shown = usePanelShown()
  return shown ? GAP + PANEL_WIDTH + GAP : GAP
}
