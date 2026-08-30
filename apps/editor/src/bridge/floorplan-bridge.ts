import type { FloorplanBridge, PlanSnapshot } from '@houseit/bridge/contract'
import { describeCommands } from '@houseit/commands/registry'
import { roomsOf } from '@houseit/geometry/rooms'
import type { createDocumentStore } from '../store/document-store'

declare global {
  interface Window {
    floorplan: FloorplanBridge
  }
}

/**
 * The only surface the MCP server touches. Failures come back as data because the
 * server reaches this through `page.evaluate`, where a thrown error arrives as an
 * opaque string — the agent needs the message the command actually produced.
 */
export function installFloorplanBridge(store: ReturnType<typeof createDocumentStore>): void {
  const snapshot = (): PlanSnapshot => {
    const { doc, level } = store.getState()
    return {
      document: doc,
      rooms: roomsOf(doc, level).map((room) => ({ name: room.name, area: room.area })),
    }
  }

  window.floorplan = {
    exec: (source) => {
      try {
        store.getState().exec(source)
        return { ok: true, ...snapshot() }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    },
    getPlan: snapshot,
    help: describeCommands,
  }
}
