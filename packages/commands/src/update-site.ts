import type { Site } from '@houseit/core/document'
import { parcelEdgeIds } from '@houseit/geometry/site'
import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { length } from './length-schema'

export const updateSite = defineCommand({
  name: 'update-site',
  summary: 'Move or turn the house on its parcel, or change its boundary setbacks',
  args: z.object({
    x: length().optional(),
    y: length().optional(),
    rotation: z.coerce.number().finite().optional(),
    setback: length().pipe(z.number().nonnegative()).optional(),
    edge: z.string().min(1).optional(),
    edgeSetback: length().pipe(z.number().nonnegative()).optional(),
  }),
  run: (draft, args) => {
    const site = draft.site
    if (!site) throw new CommandError('update-site: this project has no parcel')
    const changed = Object.values(args).some((value) => value !== undefined)
    if (!changed) {
      throw new CommandError(
        'update-site: say what to change — --x, --y, --rotation, --setback or --edge with --edge-setback',
      )
    }
    if ((args.edge === undefined) !== (args.edgeSetback === undefined)) {
      throw new CommandError('update-site: --edge and --edge-setback must be used together')
    }

    if (args.x !== undefined) site.housePlacement.xMm = args.x
    if (args.y !== undefined) site.housePlacement.yMm = args.y
    if (args.rotation !== undefined) {
      site.housePlacement.rotationMilliDegrees = Math.round(args.rotation * 1000)
    }
    if (args.setback !== undefined) site.setbacks.defaultMm = args.setback
    if (args.edge !== undefined && args.edgeSetback !== undefined) {
      if (!parcelEdgeIds(site as Site).includes(args.edge)) {
        throw new CommandError(`update-site: unknown parcel edge ${args.edge}`)
      }
      site.setbacks.byEdge[args.edge] = args.edgeSetback
    }
    return { changed: ['site'] }
  },
})
