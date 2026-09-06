import type { Room } from '@houseit/geometry/rooms'
import { sideRun } from '@houseit/geometry/sides'
import { type Along, fractionOf } from '../along-schema'
import { CommandError } from '../command-error'
import { parseWalk } from '../parse-walk'
import { linkPoints, nearWall } from '../partition'
import { sideNamed } from '../resolve'
import { type Draft, settlePieces } from './settle'

const HEADINGS = { n: { x: 0, y: 1 }, s: { x: 0, y: -1 }, e: { x: 1, y: 0 }, w: { x: -1, y: 0 } }

export function cutByWalk(
  draft: Draft,
  level: string,
  source: Room & { id: string },
  args: {
    name: string
    material: string
    thickness: number
    side?: string
    wall?: string
    along?: Along
    walk?: string
  },
): string[] {
  const at = sideNamed(
    draft,
    level,
    source,
    { side: args.side as never, wall: args.wall },
    'add-room',
  )
  const run = sideRun(draft, level, source, at.side, at.nth)
  if (!run) throw new CommandError(`add-room: ${source.name} has no wall facing ${at.side}`)
  const fraction = fractionOf(args.along ?? { fraction: 0.5 }, run, 'add-room')
  const outline = source.nodes.map((id) => draft.nodes[id]!)

  const start = {
    x: Math.round(run.from.x + (run.to.x - run.from.x) * fraction),
    y: Math.round(run.from.y + (run.to.y - run.from.y) * fraction),
  }
  let from = nearWall(draft, level, start) ?? start
  let drew = false
  for (const leg of parseWalk(args.walk ?? '')) {
    const step = HEADINGS[leg.heading]
    let to = { x: from.x + step.x * leg.length, y: from.y + step.y * leg.length }
    to = nearWall(draft, level, to) ?? to
    try {
      linkPoints(draft, level, from, to, args.thickness, 'add-room')
      drew = true
    } catch (error) {
      if (!(error instanceof CommandError)) throw error
    }
    from = to
  }
  if (!drew) throw new CommandError('add-room: there are walls there already')

  return settlePieces(draft, level, source, outline, args.name, args.material, undefined)
}
