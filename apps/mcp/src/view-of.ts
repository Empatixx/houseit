import type { ViewRequest } from '@houseit/bridge/contract'
import type { Answer } from '@houseit/commands/answer'

/**
 * What the picture should be of: what the command just did.
 *
 * One room touched and the camera goes to that room; one thing changed in it
 * and the thing itself is picked out with its clearances. Anything wider — a
 * script that furnished three rooms, a `get-plan` — gets the whole level with
 * every room's dimensions on it, because there is no one thing to point at.
 *
 * Read from the answer rather than from the words that produced it. The old way
 * parsed the script to guess what it had been about, which meant the picture
 * and the answer were two opinions about the same call.
 */
export function viewOf(answer: Answer): ViewRequest {
  const [only, ...rest] = answer.rooms
  if (!only?.name || rest.length > 0) return { dimensions: true }

  const changed = answer.changed.filter((id) => only.objects.some((object) => object.id === id))
  if (changed.length === 1) return { room: only.name, object: changed[0]! }
  return { room: only.name }
}
