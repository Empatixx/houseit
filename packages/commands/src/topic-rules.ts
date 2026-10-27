import { type HouseDocument, subjectOf } from '@houseit/core/document'
import type { Draft } from 'immer'

export function pruneTopics(draft: Draft<HouseDocument>): void {
  for (const topic of Object.values(draft.topics ?? {})) {
    const about = topic.about.filter((id) => subjectOf(draft as HouseDocument, id))
    if (about.length !== topic.about.length) topic.about = about
    if (topic.viewpoint !== undefined && !draft.viewpoints?.[topic.viewpoint])
      delete topic.viewpoint
  }
}
