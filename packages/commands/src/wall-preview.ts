import type { HouseDocument } from '@houseit/core/document'
import { produce } from 'immer'
import type { ArgsOf, TypedCommand } from './define-command'
import { assertHouseFitsSite } from './site-invariant'

const previews = new WeakSet<HouseDocument>()

export const isWallPreview = (doc: HouseDocument): boolean => previews.has(doc)

export function previewWallCommand<C extends TypedCommand>(
  doc: HouseDocument,
  command: C,
  args: ArgsOf<C>,
): HouseDocument {
  return produce(doc, (draft) => {
    previews.add(draft)
    try {
      command.apply(draft, args)
      assertHouseFitsSite(draft)
    } finally {
      previews.delete(draft)
    }
  })
}
