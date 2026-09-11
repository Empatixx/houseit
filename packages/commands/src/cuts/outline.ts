import type { HouseDocument } from '@houseit/core/document'
import { anchorInside } from '@houseit/geometry/anchor'
import { type OutlineSpec, outlinePoints, type Point, walkPoints } from '@houseit/geometry/outlines'
import type { Draft as ImmerDraft } from 'immer'
import { allocateId } from '../allocate-id'
import { CommandError } from '../command-error'
import { parseWalk } from '../parse-walk'

export function drawOutline(
  draft: ImmerDraft<HouseDocument>,
  level: string,
  args: {
    shape?: 'rectangle' | 'l' | 'u' | 't'
    walk?: string
    width?: number
    depth?: number
    notchWidth?: number
    notchDepth?: number
    barDepth?: number
    stemWidth?: number
    name: string
    material: string
    thickness: number
  },
): string[] {
  if (Object.values(draft.walls).some((wall) => wall.level === level)) {
    throw new CommandError(
      'add-room: this level already has walls — say --from, --side, --corner or --points to cut a room out of one',
    )
  }

  const shape =
    args.shape ?? (args.walk === undefined && args.width !== undefined ? 'rectangle' : undefined)
  if ((shape === undefined) === (args.walk === undefined)) {
    throw new CommandError('add-room: give either a --shape or a --walk round the outline')
  }

  const points = args.walk ? walked(args.walk) : outline({ ...args, shape })
  const height = draft.levels[level]!.height

  const nodeIds = points.map((point) => {
    const id = allocateId(draft.nodes, 'n')
    draft.nodes[id] = { id, x: point.x, y: point.y }
    return id
  })
  nodeIds.forEach((from, index) => {
    const id = allocateId(draft.walls, 'w')
    draft.walls[id] = {
      id,
      level,
      a: from,
      b: nodeIds[(index + 1) % nodeIds.length]!,
      thickness: args.thickness,
      baseOffset: 0,
      height,
    }
  })

  const area = Math.abs(shoelace(points))
  if (area === 0) throw new CommandError('add-room: that shape encloses nothing')
  const centre = anchorInside(points, shoelace(points) / 2)
  const id = allocateId(draft.rooms, 'r')
  draft.rooms[id] = {
    id,
    level,
    x: centre.x,
    y: centre.y,
    name: args.name,
    floor: args.material,
    loop: [],
  }
  return [id]
}

function walked(source: string) {
  try {
    return walkPoints(parseWalk(source))
  } catch (error) {
    if (error instanceof CommandError) throw error
    throw new CommandError(`add-room: ${(error as Error).message}`)
  }
}

function outline(args: {
  shape?: 'rectangle' | 'l' | 'u' | 't'
  width?: number
  depth?: number
  notchWidth?: number
  notchDepth?: number
  barDepth?: number
  stemWidth?: number
}) {
  try {
    return outlinePoints(specOf(args))
  } catch (error) {
    if (error instanceof CommandError) throw error
    throw new CommandError(`add-room: ${(error as Error).message}`)
  }
}

function specOf(args: {
  shape?: 'rectangle' | 'l' | 'u' | 't'
  width?: number
  depth?: number
  notchWidth?: number
  notchDepth?: number
  barDepth?: number
  stemWidth?: number
}): OutlineSpec {
  const { shape: kind, width, depth } = args
  if (kind === undefined || width === undefined || depth === undefined) {
    throw new CommandError('add-room: an outline needs a --shape, a --width and a --depth')
  }
  if (kind === 'rectangle') return { kind, width, depth }
  if (kind === 'l' || kind === 'u') {
    if (args.notchWidth === undefined || args.notchDepth === undefined) {
      throw new CommandError(`add-room: an ${kind} needs --notch-width and --notch-depth`)
    }
    return { kind, width, depth, notchWidth: args.notchWidth, notchDepth: args.notchDepth }
  }
  if (args.barDepth === undefined || args.stemWidth === undefined) {
    throw new CommandError('add-room: a t needs --bar-depth and --stem-width')
  }
  return { kind, width, depth, barDepth: args.barDepth, stemWidth: args.stemWidth }
}

function shoelace(points: Point[]): number {
  let total = 0
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!
    const b = points[(i + 1) % points.length]!
    total += a.x * b.y - b.x * a.y
  }
  return total
}
