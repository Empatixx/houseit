import type {
  Clear,
  FloorplanBridge,
  PlanSnapshot,
  ShowResult,
  ViewRequest,
} from '@houseit/bridge/contract'
import { answerFor } from '@houseit/commands/answer'
import { describeCommands } from '@houseit/commands/registry'
import { levelsOf } from '@houseit/core/levels'
import { roomsOf } from '@houseit/geometry/rooms'
import type { createDocumentStore } from '../store/document-store'
import { modeStore } from '../store/mode'
import { projectsStore as theProjects } from '../store/projects/projects'
import { selectionStore } from '../store/selection'
import { shellStore } from '../store/shell'
import { clearOf, viewStore } from '../store/view'

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
export function installFloorplanBridge(
  store: ReturnType<typeof createDocumentStore>,
  projects: typeof theProjects = theProjects,
): void {
  const snapshot = (): PlanSnapshot => {
    const { doc, level } = store.getState()
    const open = projects.getState().open
    return {
      document: doc,
      rooms: roomsOf(doc, level).map((room) => ({ name: room.name, area: room.area })),
      project: open ? { id: open.id, name: open.name } : undefined,
    }
  }

  /**
   * Nothing is worked on until a project is open, and the agent cannot open one
   * — projects belong to the editor, not to the commands. So the refusal says
   * what there is and where to open it, rather than only that it will not.
   */
  const noProject = (): string => {
    const { list, refresh } = projects.getState()
    // Asked for, so that a second attempt can name them even if this one could not.
    if (!list) void refresh()
    const ids = list?.map((project) => project.id) ?? []
    const where =
      ids.length > 0
        ? `projects: ${ids.join(', ')} (open one at /p/<id>)`
        : 'make one on the home screen'
    return `no project open — ${where}`
  }

  /** The room of that name or id, and the storey it stands on. */
  const whichStorey = (name: string) => {
    const { doc } = store.getState()
    for (const storey of levelsOf(doc)) {
      const room = roomsOf(doc, storey.id).find(
        (candidate) => candidate.name === name || candidate.id === name,
      )
      if (room?.id) return { room, level: storey.id }
    }
    return undefined
  }

  /** The part of the canvas nothing floats over, where the framing lands. */
  const clear = (): Clear => {
    const canvas = document.querySelector('canvas')
    const size = { width: canvas?.clientWidth ?? 0, height: canvas?.clientHeight ?? 0 }
    return clearOf(viewStore.getState().covers, size)
  }

  /**
   * Picks and frames what a picture should be of, the way a click and Fit
   * would: a room is highlighted with its dimensions, a thing gets its outline
   * and clearances, the level gets everything or nothing.
   */
  const show = (view: ViewRequest): ShowResult => {
    const selection = selectionStore.getState()
    // A picture for the agent is a plan, whatever the tab was looking at, and
    // with nothing over it: the panel folds until the next click.
    modeStore.getState().setMode('2d')
    shellStore.getState().showPanel(false)

    if (view.room === undefined) {
      selection.select(null)
      selection.showDimensions(view.dimensions ?? false)
      viewStore.getState().frame(null)
      return { ok: true }
    }

    // Looked for on every storey, and the one it is on is stepped onto — the
    // same thing a person does with the storey card before looking at a room
    // upstairs. A picture of the first floor was otherwise unaskable for.
    const found = whichStorey(view.room)
    if (!found) return { ok: false, error: `there is no room called ${view.room}` }
    if (found.level !== store.getState().level) store.getState().setLevel(found.level)
    const { doc } = store.getState()
    const { room } = found
    const roomId = room.id!

    let picked: { kind: 'room' | 'object'; id: string } = { kind: 'room', id: roomId }
    if (view.object !== undefined) {
      const found = doc.objects[view.object]
      if (!found || found.room !== roomId) {
        return { ok: false, error: `there is no ${view.object} in ${view.room}` }
      }
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
      if (!projects.getState().open) return { ok: false, error: noProject() }
      try {
        const touched = store.getState().exec(source)
        // Built after the transaction, off the plan as it now stands: what the
        // agent is told is read from the same document the tab is drawing.
        const { doc, level } = store.getState()
        const answer = answerFor(
          doc,
          level,
          touched.changed,
          touched.shown,
          touched.at,
          touched.notes,
        )
        // And the tab goes where the command went. A command that drew on the
        // first floor and left you looking at the ground floor would be an
        // agent working somewhere you cannot see.
        if (answer.level !== level) store.getState().setLevel(answer.level)
        return { ok: true, answer, ...snapshot() }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    },
    getPlan: snapshot,
    help: describeCommands,
    clear,
    save: () => projects.getState().save(),
    ensureProject: async (name) => {
      const { refresh, list, create } = projects.getState()
      await refresh()
      const found = (projects.getState().list ?? list ?? []).find(
        (project) => project.id === name || project.name === name,
      )
      const meta = found ?? (await create(name))
      return { id: meta.id, name: meta.name }
    },
    show: (view) => {
      if (!projects.getState().open) return { ok: false, error: noProject() }
      try {
        return show(view)
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    },
  }
}
