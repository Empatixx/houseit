import { FLOOR_MATERIAL_IDS } from '@houseit/core/floor-materials'
import { SiteSchema } from '@houseit/core/site'
import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { json } from './json-schema'

export const updateSite = defineCommand({
  name: 'update-site',
  summary:
    'Replace the exterior site with --site JSON {groundCutout,surfaces,markings,railings}, or change a surface by --surface id --material or --colour #rrggbb. Surface elevation is at its first outline point, slope x/y is rise/run; all heights are mm above the building datum. Markings follow their named surface. An empty set removes the site geometry.',
  args: z.object({
    site: json(SiteSchema).optional(),
    surface: z.string().optional(),
    material: z.enum(FLOOR_MATERIAL_IDS as [string, ...string[]]).optional(),
    colour: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
  }),
  run: (draft, args) => {
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
