import type { Camera, HouseDocument, Topic } from '@houseit/core/document'
import * as OBC from '@thatopen/components'

const STATUS: Record<Topic['status'], string> = {
  open: 'Open',
  'in-progress': 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
}
const STATUS_IN = Object.fromEntries(
  Object.entries(STATUS).map(([ours, theirs]) => [theirs.toLowerCase(), ours]),
) as Record<string, Topic['status']>

type Vector = { x: number; y: number; z: number }

const toWorld = ({ x, y, z }: Vector, scale = 1) => ({ x: x * scale, y: z * scale, z: -y * scale })
const fromWorld = ({ x, y, z }: Vector, scale = 1) => ({
  x: Math.round(x * scale * 1e6) / 1e6 + 0,
  y: Math.round(-z * scale * 1e6) / 1e6 + 0,
  z: Math.round(y * scale * 1e6) / 1e6 + 0,
})
const UP = { x: 0, y: 0, z: 1 }

function setUp(components: OBC.Components) {
  const bcf = components.get(OBC.BCFTopics)
  if (!bcf.isSetup)
    bcf.setup({
      author: 'houseit',
      types: new Set(['Issue', 'Remark', 'Request', 'Clash']),
      statuses: new Set(Object.values(STATUS)),
    })
  return { bcf, viewpoints: components.get(OBC.Viewpoints) }
}

function cameraOf(camera: Camera) {
  const base = {
    camera_view_point: toWorld(camera.position, 1 / 1000),
    camera_direction: toWorld(camera.direction),
    camera_up_vector: toWorld(camera.up),
    aspect_ratio: 16 / 9,
  }
  return camera.projection === 'orthographic'
    ? { orthogonal_camera: { ...base, view_to_world_scale: (camera.viewWidth ?? 10_000) / 1000 } }
    : { perspective_camera: { ...base, field_of_view: camera.fieldOfView ?? 60 } }
}

export async function exportBcf(
  components: OBC.Components,
  doc: HouseDocument,
  guidOf: (id: string) => string | undefined,
): Promise<Blob> {
  const { bcf, viewpoints } = setUp(components)
  const created: OBC.Topic[] = []
  try {
    for (const topic of Object.values(doc.topics ?? {})) {
      const made = bcf.create({
        title: topic.title,
        type: topic.type ?? 'Issue',
        status: STATUS[topic.status],
        creationAuthor: topic.author,
        creationDate: new Date(topic.created),
        ...(topic.description ? { description: topic.description } : {}),
        ...(topic.priority ? { priority: topic.priority } : {}),
      })
      created.push(made)
      const view = topic.viewpoint ? doc.viewpoints?.[topic.viewpoint] : undefined
      if (view) {
        const viewpoint = viewpoints.create(cameraOf(view.camera))
        for (const id of topic.about) {
          const guid = guidOf(id)
          if (guid) viewpoint.selectionComponents.add(guid)
        }
        made.viewpoints.add(viewpoint.guid)
      }
      for (const remark of topic.comments) {
        const comment = made.createComment(remark.text)
        comment.author = remark.author
        comment.date = new Date(remark.date)
      }
    }
    return await bcf.export(created)
  } finally {
    for (const topic of created) bcf.list.delete(topic.guid)
    viewpoints.list.clear()
  }
}

export type ImportedView = { guid: string; name: string; camera: Camera }
export type ImportedTopic = Omit<Topic, 'id' | 'viewpoint' | 'about'> & {
  viewpoint?: string
  about: string[]
}

export async function importBcf(
  components: OBC.Components,
  bytes: Uint8Array,
): Promise<{ views: ImportedView[]; topics: ImportedTopic[] }> {
  const { bcf, viewpoints } = setUp(components)
  const { topics, viewpoints: views } = await bcf.load(bytes)
  try {
    return {
      views: views.map((view) => {
        const camera = view.camera as {
          camera_view_point: { x: number; y: number; z: number }
          camera_direction: { x: number; y: number; z: number }
          camera_up_vector: { x: number; y: number; z: number }
          field_of_view?: number
          view_to_world_scale?: number
        }
        const orthographic = camera.view_to_world_scale !== undefined
        const up = fromWorld(camera.camera_up_vector)
        const owner = topics.find((topic) => topic.viewpoints.has(view.guid))
        return {
          guid: view.guid,
          name: view.title ?? owner?.title ?? 'View',
          camera: {
            projection: orthographic ? 'orthographic' : 'perspective',
            position: fromWorld(camera.camera_view_point, 1000),
            direction: fromWorld(camera.camera_direction),
            up: up.x || up.y || up.z ? up : UP,
            ...(orthographic
              ? { viewWidth: Math.round(camera.view_to_world_scale! * 1000) }
              : { fieldOfView: camera.field_of_view ?? 60 }),
          },
        }
      }),
      topics: topics.map((topic) => ({
        title: topic.title,
        status: STATUS_IN[topic.status.toLowerCase()] ?? 'open',
        type: topic.type,
        ...(topic.priority ? { priority: topic.priority } : {}),
        author: topic.creationAuthor || 'houseit',
        created: topic.creationDate.toISOString(),
        ...(topic.description ? { description: topic.description } : {}),
        comments: [...topic.comments.values()].map((comment) => ({
          author: comment.author || 'houseit',
          date: comment.date.toISOString(),
          text: comment.comment,
        })),
        ...([...topic.viewpoints][0] ? { viewpoint: [...topic.viewpoints][0] } : {}),
        about: [...topic.viewpoints].flatMap((guid) => [
          ...(viewpoints.list.get(guid)?.selectionComponents ?? []),
        ]),
      })),
    }
  } finally {
    for (const topic of topics) bcf.list.delete(topic.guid)
    viewpoints.list.clear()
  }
}
