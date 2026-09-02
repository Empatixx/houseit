import type {
  FloorplanBridge,
  PlanSnapshot,
  ShowResult,
  ViewRequest,
} from '@houseit/bridge/contract'
import { describeCommands } from '@houseit/commands/registry'
import { newest } from '@houseit/commands/resolve'
import { roomsOf } from '@houseit/geometry/rooms'
import type { createDocumentStore } from '../store/document-store'
import { selectionStore } from '../store/selection'
import { viewStore } from '../store/view'

declare global {
  interface Window {
    floorplan: FloorplanBridge
  }
}

/**
 * Room left round a room when it is framed on its own, in millimetres: enough
 * for its walls, a door swinging out of it and the dimensions along them.
 */
const ROOM_MARGIN = 1200

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

  /**
   * Picks and frames what a picture should be of, the way a click and Fit
   * would: a room is highlighted with its dimensions, a thing gets its outline
   * and clearances, the level gets everything or nothing.
   */
  const show = (view: ViewRequest): ShowResult => {
    const { doc, level } = store.getState()
    const selection = selectionStore.getState()

    if (view.room === undefined) {
      selection.select(null)
      selection.showDimensions(view.dimensions ?? false)
      viewStore.getState().frame(null)
      return { ok: true }
    }

    const room = roomsOf(doc, level).find((candidate) => candidate.name === view.room)
    if (!room?.id) return { ok: false, error: `there is no room called ${view.room}` }
    const roomId = room.id

    let picked: { kind: 'room' | 'object'; id: string } = { kind: 'room', id: roomId }
    if (view.type !== undefined) {
      const found = newest(
        Object.values(doc.objects).filter((it) => it.room === roomId && it.type === view.type),
      )
      if (!found) return { ok: false, error: `there is no ${view.type} in ${view.room}` }
      picked = { kind: 'object', id: found.id }
    }

    const corners = room.nodes.map((id) => doc.nodes[id]).filter((node) => node !== undefined)
    const xs = corners.map((corner) => corner.x)
    const ys = corners.map((corner) => corner.y)
    selection.select(picked)
    selection.showDimensions(false)
    viewStore.getState().frame({
      x0: Math.min(...xs) - ROOM_MARGIN,
      y0: Math.min(...ys) - ROOM_MARGIN,
      x1: Math.max(...xs) + ROOM_MARGIN,
      y1: Math.max(...ys) + ROOM_MARGIN,
    })
    return { ok: true }
  }

  window.floorplan = {
    exec: (source) => {
      try {
        const output = store.getState().exec(source)
        return { ok: true, output, ...snapshot() }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    },
    getPlan: snapshot,
    help: describeCommands,
    show: (view) => {
      try {
        return show(view)
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    },
  }
}
