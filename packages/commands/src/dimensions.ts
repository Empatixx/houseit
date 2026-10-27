import { DRAWING_VIEWS } from '@houseit/core/document'
import { z } from 'zod'
import { allocateId } from './allocate-id'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { json } from './json-schema'
import { length } from './length-schema'

const Point = z.object({ x: length(), y: length(), z: length() })

export const addDimension = defineCommand({
  name: 'add-dimension',
  summary: `Dimension a section or elevation drawing (${DRAWING_VIEWS.join(', ')}): --from and --to are JSON {x,y,z} points in mm east, north and up, and --offset how far the dimension line stands off them in mm; the drawing and its DXF show it from then on`,
  args: z.object({
    view: z.enum(DRAWING_VIEWS),
    from: json(Point),
    to: json(Point),
    offset: length().optional(),
  }),
  run: (draft, args) => {
    if (args.from.x === args.to.x && args.from.y === args.to.y && args.from.z === args.to.z)
      throw new CommandError('add-dimension: --from and --to are the same point')
    draft.dimensions ??= {}
    const id = allocateId(draft.dimensions, 'd')
    draft.dimensions[id] = {
      id,
      view: args.view,
      from: args.from,
      to: args.to,
      offset: args.offset ?? 500,
    }
    return { changed: [id] }
  },
})

export const removeDimension = defineCommand({
  name: 'remove-dimension',
  summary: 'Take a dimension off its drawing, by the id its answer gave',
  args: z.object({ id: z.string().min(1) }),
  run: (draft, args) => {
    if (!draft.dimensions?.[args.id])
      throw new CommandError(`remove-dimension: there is no dimension ${args.id}`)
    delete draft.dimensions[args.id]
    if (Object.keys(draft.dimensions).length === 0) delete draft.dimensions
    return { changed: [args.id] }
  },
})
