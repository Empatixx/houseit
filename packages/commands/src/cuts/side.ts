import type { Axis } from '@houseit/geometry/cut'
import { crossingsOf } from '@houseit/geometry/cut'
import type { Room } from '@houseit/geometry/rooms'
import { CommandError } from '../command-error'
import { partitionAlong } from '../partition'
import { type Draft, settleCut } from './settle'

const SIDES = {
  west: { axis: 'x', fromLow: true },
  east: { axis: 'x', fromLow: false },
  south: { axis: 'y', fromLow: true },
  north: { axis: 'y', fromLow: false },
} as const satisfies Record<string, { axis: Axis; fromLow: boolean }>

export function cutBySide(
  draft: Draft,
  level: string,
  source: Room,
  args: {
    name: string
    from?: string
    material: string
    thickness: number
    side: keyof typeof SIDES
    width?: number
    depth?: number
  },
): string[] {
  const width = args.width ?? args.depth
  if (width === undefined) {
    throw new CommandError('add-room: a strip needs a --width or a --depth; a box needs both')
  }

  const { axis, fromLow } = SIDES[args.side]
  const points = source.nodes.map((id) => draft.nodes[id]!)
  const low = Math.min(...points.map((point) => point[axis]))
  const high = Math.max(...points.map((point) => point[axis]))

  if (width >= high - low) {
    throw new CommandError(
      `add-room: ${args.name} is wider than ${args.from}, which is only ${high - low} mm across`,
    )
  }
  const at = fromLow ? low + width : high - width

  const crossings = crossingsOf(draft, level, source, axis, at)
  if (crossings.length !== 2) {
    const pieces = Math.max(2, Math.round(crossings.length / 2))
    throw new CommandError(
      `add-room: a strip off the ${args.side} of ${args.from ?? source.name ?? 'the floor'} would fall in ${pieces} pieces, because that side is broken — cut from a side that runs straight, or draw the room with --walk`,
    )
  }

  partitionAlong(draft, level, source, axis, at, args.thickness, 'add-room')
  return settleCut(draft, level, source, args.name, args.material, axis, at, fromLow)
}
