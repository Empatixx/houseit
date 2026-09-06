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

const ROOM_MARGIN = 1200

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

  const noProject = (): string => {
    const { list, refresh } = projects.getState()
    if (!list) void refresh()
    const ids = list?.map((project) => project.id) ?? []
    const where =
      ids.length > 0
        ? `projects: ${ids.join(', ')} (open one at /p/<id>)`
        : 'make one on the home screen'
    return `no project open — ${where}`
  }

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

  const clear = (): Clear => {
    const canvas = document.querySelector('canvas')
    const size = { width: canvas?.clientWidth ?? 0, height: canvas?.clientHeight ?? 0 }
    return clearOf(viewStore.getState().covers, size)
  }

  const show = (view: ViewRequest): ShowResult => {
    const selection = selectionStore.getState()
    modeStore.getState().setMode('2d')
    shellStore.getState().showPanel(false)

    if (view.room === undefined) {
      selection.select(null)
      selection.showDimensions(view.dimensions ?? false)
      viewStore.getState().frame(null)
      return { ok: true }
    }

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
        const { doc, level } = store.getState()
        const answer = answerFor(
          doc,
          level,
          touched.changed,
          touched.shown,
          touched.at,
          touched.notes,
        )
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
