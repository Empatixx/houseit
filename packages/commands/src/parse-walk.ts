import type { Leg } from '@houseit/geometry/outlines'
import { CommandError } from './command-error'
import { parseLength } from './length'

const HEADINGS: Record<string, Leg['heading']> = {
  n: 'n',
  north: 'n',
  s: 's',
  south: 's',
  e: 'e',
  east: 'e',
  w: 'w',
  west: 'w',
}

/**
 * A walk round a building, written the way it would be said out loud:
 * `12m e, 8m n, 4m w, 3m n, 8m w`.
 *
 * Lengths and headings, no coordinates — the same reason every other command
 * takes none. The way home is left off; it closes itself.
 */
export function parseWalk(source: string): Leg[] {
  const legs = source
    .split(/[,;]+/)
    .map((leg) => leg.trim())
    .filter((leg) => leg.length > 0)

  if (legs.length === 0) {
    throw new CommandError('floor-shape: the walk is empty')
  }

  return legs.map((leg) => {
    const parts = leg.split(/\s+/)
    const heading = HEADINGS[(parts.pop() ?? '').toLowerCase()]
    if (!heading) {
      throw new CommandError(
        `floor-shape: "${leg}" does not say which way to go — end each leg with n, s, e or w`,
      )
    }

    const length = parseLength(parts.join(''))
    if (length === undefined || length <= 0) {
      throw new CommandError(`floor-shape: "${leg}" does not say how far to go`)
    }
    return { heading, length }
  })
}
