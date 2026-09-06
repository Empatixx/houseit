import type { ViewRequest } from '@houseit/bridge/contract'
import type { Answer } from '@houseit/commands/answer'

export function viewOf(answer: Answer): ViewRequest {
  const [only, ...rest] = answer.rooms
  if (!only?.name || rest.length > 0) return { dimensions: true }

  const changed = answer.changed.filter((id) => only.objects.some((object) => object.id === id))
  if (changed.length === 1) return { room: only.name, object: changed[0]! }
  return { room: only.name }
}
