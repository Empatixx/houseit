import type { FloorplanBridge } from '@houseit/bridge/contract'

declare global {
  interface Window {
    floorplan: FloorplanBridge
  }
}
