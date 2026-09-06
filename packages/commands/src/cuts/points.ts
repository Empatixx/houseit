import type { Point } from '@houseit/geometry/outlines'
import { containsPoint, type Room, roomsOf } from '@houseit/geometry/rooms'
import { CommandError } from '../command-error'
import { parseLength } from '../length'
import { linkPoints, nearWall } from '../partition'
import { roomNamed } from '../resolve'
import { type Draft, settlePieces } from './settle'

export function cutByPoints(
  draft: Draft,
  level: string,
  args: { name: string; from?: string; material: string; thickness: number; points: string },
): string[] {
  const polygon = parsePoints(args.points).map((corner) => nearWall(draft, level, corner) ?? corner)
  const source =
    args.from !== undefined
      ? roomNamed(draft, level, args.from, 'add-room')
      : roomsOf(draft, level).find((room) =>
          containsPoint(
            room.nodes.map((id) => draft.nodes[id]!),
            polygon[0]!.x,
            polygon[0]!.y,
          ),
        )
  if (!source?.id) {
    throw new CommandError(
      'add-room: the first corner lies in no room — say --from, or draw the floor first',
    )
  }
  const outline = source.nodes.map((id) => draft.nodes[id]!)

  let drew = false
  polygon.forEach((from, index) => {
    const to = polygon[(index + 1) % polygon.length]!
    try {
      linkPoints(draft, level, from, to, args.thickness, 'add-room')
      drew = true
    } catch (error) {
      if (!(error instanceof CommandError)) throw error
    }
  })
  if (!drew) throw new CommandError('add-room: there are walls there already')

  return settlePieces(
    draft,
    level,
    source as Room & { id: string },
    outline,
    args.name,
    args.material,
    (face) => containsPoint(polygon, face.x, face.y),
  )
}

function parsePoints(source: string): Point[] {
  const points = source
    .split(/[;\n]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const pair = part.split(',').map((it) => it.trim())
      if (pair.length !== 2) throw new CommandError(`add-room: "${part}" is not an x,y corner`)
      return { x: parseLength(pair[0]!), y: parseLength(pair[1]!) }
    })
  if (points.length < 3) throw new CommandError('add-room: --points needs at least three corners')
  return points
}
