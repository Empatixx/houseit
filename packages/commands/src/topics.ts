import { CameraSchema, type HouseDocument, subjectOf } from '@houseit/core/document'
import { z } from 'zod'
import { allocateId } from './allocate-id'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { json } from './json-schema'
import { levelOf } from './resolve'

const STATUS = z.enum(['open', 'in-progress', 'resolved', 'closed'])
const HIDDEN = z.array(z.enum(['furniture', 'openings', 'roofs', 'ceilings', 'site']))
const now = () => new Date().toISOString()

function subjects(draft: HouseDocument, ids: string[] | undefined, verb: string) {
  for (const id of ids ?? [])
    if (!subjectOf(draft, id))
      throw new CommandError(`${verb}: there is no room, wall, door, window or thing ${id}`)
  return ids ?? []
}

export const addViewpoint = defineCommand({
  name: 'add-viewpoint',
  summary:
    'Save a named view: --camera JSON {projection: perspective|orthographic, position, direction, up as {x,y,z} in mm east, north and up, fieldOfView or viewWidth}, --mode plan|3d, and what was --hidden',
  args: z.object({
    name: z.string().min(1),
    camera: json(CameraSchema),
    mode: z.enum(['plan', '3d']),
    level: z.string().optional(),
    hidden: json(HIDDEN).optional(),
  }),
  run: (draft, args, open) => {
    draft.viewpoints ??= {}
    const id = allocateId(draft.viewpoints, 'v')
    draft.viewpoints[id] = {
      id,
      name: args.name,
      level: levelOf(draft, args.level ?? open, 'add-viewpoint'),
      mode: args.mode,
      camera: args.camera,
      ...(args.hidden?.length ? { hidden: args.hidden } : {}),
    }
    return { changed: [id] }
  },
})

export const removeViewpoint = defineCommand({
  name: 'remove-viewpoint',
  summary: 'Forget a saved view, by its id; topics that pointed at it keep everything else',
  args: z.object({ id: z.string().min(1) }),
  run: (draft, args) => {
    if (!draft.viewpoints?.[args.id])
      throw new CommandError(`remove-viewpoint: there is no view ${args.id}`)
    delete draft.viewpoints[args.id]
    if (Object.keys(draft.viewpoints).length === 0) delete draft.viewpoints
    for (const topic of Object.values(draft.topics ?? {}))
      if (topic.viewpoint === args.id) delete topic.viewpoint
    return { changed: [args.id] }
  },
})

export const addTopic = defineCommand({
  name: 'add-topic',
  summary:
    'Pin a remark to the plan, as a BCF topic does: --title, --about ids of rooms, walls, doors, windows or things, a saved --viewpoint or a new one from --camera with --mode plan|3d, --status open|in-progress|resolved|closed, --type, --priority, --author, --description and a first --comment',
  args: z.object({
    title: z.string().min(1),
    about: json(z.array(z.string().min(1))).optional(),
    viewpoint: z.string().min(1).optional(),
    status: STATUS.optional(),
    type: z.string().min(1).optional(),
    priority: z.string().min(1).optional(),
    author: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    comment: z.string().min(1).optional(),
    date: z.string().min(1).optional(),
    camera: json(CameraSchema).optional(),
    mode: z.enum(['plan', '3d']).optional(),
    level: z.string().optional(),
    hidden: json(HIDDEN).optional(),
  }),
  run: (draft, args, open) => {
    const verb = 'add-topic'
    if (args.camera && args.viewpoint)
      throw new CommandError(`${verb}: say --viewpoint or --camera, not both`)
    let viewpoint = args.viewpoint
    if (args.camera) {
      draft.viewpoints ??= {}
      viewpoint = allocateId(draft.viewpoints, 'v')
      draft.viewpoints[viewpoint] = {
        id: viewpoint,
        name: args.title,
        level: levelOf(draft, args.level ?? open, verb),
        mode: args.mode ?? 'plan',
        camera: args.camera,
        ...(args.hidden?.length ? { hidden: args.hidden } : {}),
      }
    }
    if (args.viewpoint !== undefined && !draft.viewpoints?.[args.viewpoint])
      throw new CommandError(`${verb}: there is no view ${args.viewpoint}`)
    draft.topics ??= {}
    const id = allocateId(draft.topics, 't')
    const author = args.author ?? 'houseit'
    const created = args.date ?? now()
    draft.topics[id] = {
      id,
      title: args.title,
      status: args.status ?? 'open',
      author,
      created,
      about: subjects(draft as HouseDocument, args.about, verb),
      comments: args.comment ? [{ author, date: created, text: args.comment }] : [],
      ...(args.type ? { type: args.type } : {}),
      ...(args.priority ? { priority: args.priority } : {}),
      ...(args.description ? { description: args.description } : {}),
      ...(viewpoint ? { viewpoint } : {}),
    }
    return { changed: viewpoint && viewpoint !== args.viewpoint ? [id, viewpoint] : [id] }
  },
})

export const updateTopic = defineCommand({
  name: 'update-topic',
  summary:
    'Change a topic by its id: --status, --title, --about, --viewpoint, or add a --comment (with --author)',
  args: z.object({
    id: z.string().min(1),
    status: STATUS.optional(),
    title: z.string().min(1).optional(),
    about: json(z.array(z.string().min(1))).optional(),
    viewpoint: z.string().min(1).optional(),
    comment: z.string().min(1).optional(),
    author: z.string().min(1).optional(),
    date: z.string().min(1).optional(),
  }),
  run: (draft, args) => {
    const verb = 'update-topic'
    const topic = draft.topics?.[args.id]
    if (!topic) throw new CommandError(`${verb}: there is no topic ${args.id}`)
    if (args.viewpoint !== undefined && !draft.viewpoints?.[args.viewpoint])
      throw new CommandError(`${verb}: there is no view ${args.viewpoint}`)
    if (args.status) topic.status = args.status
    if (args.title) topic.title = args.title
    if (args.about) topic.about = subjects(draft as HouseDocument, args.about, verb)
    if (args.viewpoint) topic.viewpoint = args.viewpoint
    if (args.comment)
      topic.comments.push({
        author: args.author ?? 'houseit',
        date: args.date ?? now(),
        text: args.comment,
      })
    return { changed: [args.id] }
  },
})

export const removeTopic = defineCommand({
  name: 'remove-topic',
  summary: 'Take a topic and its comments off the plan, by its id',
  args: z.object({ id: z.string().min(1) }),
  run: (draft, args) => {
    if (!draft.topics?.[args.id])
      throw new CommandError(`remove-topic: there is no topic ${args.id}`)
    delete draft.topics[args.id]
    if (Object.keys(draft.topics).length === 0) delete draft.topics
    return { changed: [args.id] }
  },
})
