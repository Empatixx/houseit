import type { Room } from '@houseit/geometry/rooms'
import { CommandError } from '../command-error'
import { type Corner, cutCorner } from '../cut-corner'
import { type Draft, settle } from './settle'

export function cutByCorner(
  draft: Draft,
  level: string,
  source: Room,
  args: {
    name: string
    material: string
    thickness: number
    corner: Corner
    width?: number
    depth?: number
    notchWidth?: number
    notchDepth?: number
  },
): string[] {
  const { width } = args
  if (width === undefined) {
    throw new CommandError('add-room: a strip needs a --width or a --depth; a box needs both')
  }
  if (args.depth === undefined) {
    throw new CommandError('add-room: a corner needs a depth as well as a width')
  }
  if ((args.notchWidth === undefined) !== (args.notchDepth === undefined)) {
    throw new CommandError('add-room: a notch needs both --notch-width and --notch-depth')
  }

  const corner = cutCorner(draft, level, source, args.corner, {
    width,
    depth: args.depth,
    thickness: args.thickness,
    ...(args.notchWidth !== undefined && args.notchDepth !== undefined
      ? { notch: { width: args.notchWidth, depth: args.notchDepth } }
      : {}),
  })
  return settle(draft, level, source, args.name, args.material, corner.taken, corner.left)
}
