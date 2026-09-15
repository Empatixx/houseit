import { FLOOR_MATERIAL_IDS } from '@houseit/core/floor-materials'
import type { Site } from '@houseit/core/parcel-site'
import { SiteSchema } from '@houseit/core/site'
import { parcelEdgeIds } from '@houseit/geometry/site'
import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { json } from './json-schema'
import { length } from './length-schema'

export const updateSite = defineCommand({
  name: 'update-site',
  summary:
    'Move the house on its parcel with --x/--y/--rotation, change --setback or --edge/--edge-setback. Replace the exterior site with --site JSON {groundCutout,surfaces,markings,railings}, or change a surface by --surface id --material or --colour #rrggbb. Surface elevation is at its first outline point, slope x/y is rise/run; all heights are mm above the building datum. Markings follow their named surface. An empty set removes the site geometry.',
  args: z.object({
    x: length().optional(),
    y: length().optional(),
    rotation: z.coerce.number().finite().optional(),
    setback: length().pipe(z.number().nonnegative()).optional(),
    edge: z.string().min(1).optional(),
    edgeSetback: length().pipe(z.number().nonnegative()).optional(),

    site: json(SiteSchema).optional(),
    surface: z.string().optional(),
    material: z.enum(FLOOR_MATERIAL_IDS as [string, ...string[]]).optional(),
    colour: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
  }),
  run: (draft, args) => {
    const parcelEdit = [
      args.x,
      args.y,
      args.rotation,
      args.setback,
      args.edge,
      args.edgeSetback,
    ].some((value) => value !== undefined)
    if (parcelEdit) {
      if (args.site || args.surface || args.material || args.colour)
        throw new CommandError('update-site: edit terrain and parcel placement separately')
      const site = draft.parcelSite
      if (!site) throw new CommandError('update-site: this project has no parcel')
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
    }

    if (args.site) {
      if (args.surface || args.material || args.colour)
        throw new CommandError(
          'update-site: use --site alone, or select --surface to change its finish',
        )
      draft.site = args.site
    } else {
      if (!args.surface || (!args.material && !args.colour))
        throw new CommandError('update-site: give --site, or --surface with --material or --colour')
      const surface = draft.site?.surfaces.find((s) => s.id === args.surface)
      if (!surface) throw new CommandError(`update-site: unknown surface ${args.surface}`)
      if (args.material) {
        surface.material = args.material
        surface.colour = '#ffffff'
      }
      if (args.colour) surface.colour = args.colour
    }
    return {
      notes: [
        `Site: ${draft.site!.surfaces.length} surfaces, ${draft.site!.markings.length} markings, ${draft.site!.railings.length} railings`,
      ],
    }
  },
})
