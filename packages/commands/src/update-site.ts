import { SiteSchema } from '@houseit/core/site'
import { z } from 'zod'
import { defineCommand } from './define-command'
import { json } from './json-schema'

export const updateSite = defineCommand({
  name: 'update-site',
  summary:
    'Replace the exterior site with --site JSON {groundCutout,surfaces,markings,railings}. Surface elevation is at its first outline point, slope x/y is rise/run; all heights are mm above the building datum. Markings follow their named surface. An empty set removes the site geometry.',
  args: z.object({ site: json(SiteSchema) }),
  run: (draft, args) => {
    draft.site = args.site
    return {
      notes: [
        `Site: ${args.site.surfaces.length} surfaces, ${args.site.markings.length} markings, ${args.site.railings.length} railings`,
      ],
    }
  },
})
