import { addTopic, addViewpoint, removeTopic, updateTopic } from '@houseit/commands/topics'
import type { Camera, HouseDocument, Topic, Viewpoint } from '@houseit/core/document'
import { subjectOf } from '@houseit/core/document'
import { ifcGuidOf } from '@houseit/core/ifc-guid'
import { OrthographicCamera, type PerspectiveCamera, Vector3 } from 'three'
import { activeTools } from '../engine/native-tools'
import { engineViewStore } from '../store/engine-view'
import { modeStore } from '../store/mode'
import { selectionStore } from '../store/selection'
import { documentStore } from '../store/store'
import { viewStore } from '../store/view'
import { walkStore } from '../store/walk'
import { runEdit } from './run-edit'

const AUTHOR_KEY = 'houseit-author'

export function author(): string {
  try {
    return localStorage.getItem(AUTHOR_KEY) || 'houseit'
  } catch {
    return 'houseit'
  }
}

export function setAuthor(name: string) {
  try {
    localStorage.setItem(AUTHOR_KEY, name)
  } catch {}
}

const plan = (v: Vector3, scale = 1000) => ({
  x: Math.round(v.x * scale),
  y: Math.round(-v.z * scale),
  z: Math.round(v.y * scale),
})
const direction = (v: Vector3) => ({ x: v.x, y: -v.z, z: v.y })

function captureView(): { mode: Viewpoint['mode']; camera: Camera } | undefined {
  const camera = activeTools?.world.camera.three
  if (!camera) return undefined
  const mode = modeStore.getState().mode === '3d' ? '3d' : 'plan'
  const look = camera.getWorldDirection(new Vector3())
  if (camera instanceof OrthographicCamera)
    return {
      mode,
      camera: {
        projection: 'orthographic',
        position: plan(camera.position),
        direction: direction(look),
        up: { x: 0, y: 1, z: 0 },
        viewWidth: Math.round(((camera.right - camera.left) / camera.zoom) * 1000),
      },
    }
  return {
    mode,
    camera: {
      projection: 'perspective',
      position: plan(camera.position),
      direction: direction(look),
      up: { x: 0, y: 0, z: 1 },
      fieldOfView: Math.round((camera as PerspectiveCamera).fov),
    },
  }
}

export function goTo(viewpoint: Viewpoint) {
  const state = documentStore.getState()
  if (state.doc.levels[viewpoint.level]) state.setLevel(viewpoint.level)
  engineViewStore.getState().configure({ hidden: viewpoint.hidden ?? [] })
  const { position: at, direction: look, viewWidth } = viewpoint.camera
  if (viewpoint.mode === 'plan') {
    modeStore.getState().setMode('2d')
    const half = (viewWidth ?? 10_000) / 2
    viewStore.getState().frame({
      x0: at.x - half,
      y0: at.y - half * 0.6,
      x1: at.x + half,
      y1: at.y + half * 0.6,
    })
    return
  }
  modeStore.getState().setMode('3d')
  const eye: [number, number, number] = [at.x / 1000, at.z / 1000, -at.y / 1000]
  walkStore.getState().inspect({
    at: eye,
    target: [eye[0] + look.x * 5, eye[1] + look.z * 5, eye[2] - look.y * 5],
    span: 10,
    orthographic: viewpoint.camera.projection === 'orthographic',
  })
}

export function pinTopic(title: string, comment: string): boolean {
  const view = captureView()
  const selected = selectionStore.getState().selected
  const about = selected && 'id' in selected && typeof selected.id === 'string' ? [selected.id] : []
  const doc = documentStore.getState().doc
  return runEdit(() =>
    documentStore.getState().apply(addTopic, {
      title,
      author: author(),
      about: about.filter((id) => subjectOf(doc, id)),
      ...(comment ? { comment } : {}),
      ...(view
        ? {
            camera: view.camera,
            mode: view.mode,
            hidden: [...engineViewStore.getState().hidden],
          }
        : {}),
    }),
  )
}

export function saveView(name: string): boolean {
  const view = captureView()
  if (!view) return false
  return runEdit(() =>
    documentStore.getState().apply(addViewpoint, {
      name,
      camera: view.camera,
      mode: view.mode,
      hidden: [...engineViewStore.getState().hidden],
    }),
  )
}

export const setStatus = (topic: Topic, status: Topic['status']) =>
  runEdit(() => documentStore.getState().apply(updateTopic, { id: topic.id, status }))

export const comment = (topic: Topic, text: string) =>
  runEdit(() =>
    documentStore.getState().apply(updateTopic, { id: topic.id, comment: text, author: author() }),
  )

export const dropTopic = (topic: Topic) =>
  runEdit(() => documentStore.getState().apply(removeTopic, { id: topic.id }))

function guids(doc: HouseDocument): Map<string, string> {
  const found = new Map<string, string>()
  const ids = [
    ...Object.keys(doc.rooms),
    ...Object.keys(doc.objects),
    ...Object.keys(doc.openings),
    ...Object.values(doc.walls).map((wall) => wall.element ?? wall.id),
  ]
  for (const id of ids) {
    const subject = subjectOf(doc, id)
    if (subject) found.set(id, ifcGuidOf(`${subject}:${id}`))
  }
  return found
}

export async function exportTopics(): Promise<Blob> {
  const tools = activeTools
  if (!tools) throw new Error('the editor has no engine running yet')
  const { exportBcf } = await import('../engine/bcf')
  const doc = documentStore.getState().doc
  const known = guids(doc)
  return exportBcf(tools.components, doc, (id) => known.get(id))
}

export async function importTopics(bytes: Uint8Array): Promise<number> {
  const tools = activeTools
  if (!tools) throw new Error('the editor has no engine running yet')
  const { importBcf } = await import('../engine/bcf')
  const { views, topics } = await importBcf(tools.components, bytes)
  const store = documentStore.getState()
  const byGuid = new Map([...guids(store.doc)].map(([id, guid]) => [guid, id]))
  let added = 0
  for (const topic of topics) {
    const view = views.find((it) => it.guid === topic.viewpoint)
    const ok = runEdit(() => {
      const said = store.apply(addTopic, {
        title: topic.title,
        status: topic.status,
        author: topic.author,
        date: topic.created,
        about: topic.about.flatMap((guid) => byGuid.get(guid) ?? []),
        ...(topic.type ? { type: topic.type } : {}),
        ...(topic.priority ? { priority: topic.priority } : {}),
        ...(topic.description ? { description: topic.description } : {}),
        ...(view ? { camera: view.camera, mode: '3d' as const } : {}),
      })
      const id = said.changed[0]!
      for (const remark of topic.comments)
        store.apply(updateTopic, {
          id,
          comment: remark.text,
          author: remark.author,
          date: remark.date,
        })
    })
    if (ok) added++
  }
  return added
}
