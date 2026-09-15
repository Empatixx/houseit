import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'

export const removeSite = defineCommand({
  name: 'remove-site',
  summary: 'Detach the cadastral parcel without changing the house',
  args: z.object({}),
  run: (draft) => {
    if (!draft.parcelSite) throw new CommandError('remove-site: this project has no parcel')
    delete draft.parcelSite
    return { changed: ['site'] }
  },
})
