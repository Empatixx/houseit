import { SiteSchema } from '@houseit/core/document'
import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'

export const addSite = defineCommand({
  name: 'add-site',
  summary: 'Attach one normalized cadastral parcel snapshot to the house',
  args: z.object({ json: z.string().min(1) }),
  run: (draft, args) => {
    if (draft.site) throw new CommandError('add-site: this project already has a parcel')

    let input: unknown
    try {
      input = JSON.parse(args.json)
    } catch {
      throw new CommandError('add-site: --json is not valid JSON')
    }
    const parsed = SiteSchema.safeParse(input)
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '<site>'}: ${issue.message}`)
        .join('; ')
      throw new CommandError(`add-site: ${detail}`)
    }

    draft.site = parsed.data
    return { changed: ['site'] }
  },
})
