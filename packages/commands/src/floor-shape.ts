import { centroidOf } from '@houseit/geometry/centroid'
import { type OutlineSpec, outlinePoints } from '@houseit/geometry/outlines'
import { z } from 'zod'
import { allocateId } from './allocate-id'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { length } from './length-schema'

/** Exterior walls are heavier than the partitions that get cut into them later. */
const EXTERIOR_THICKNESS = 300

/**
 * The first command of any plan. You pick a standard building shape and give it
 * real dimensions — never coordinates. What it leaves behind is one room covering
 * the whole floor, which every later room is cut out of.
 */
export const floorShape = defineCommand({
  name: 'floor-shape',
  summary: 'Draw the outline of a floor from a standard shape (rectangle, l, u, t)',
  args: z.object({
    kind: z.enum(['rectangle', 'l', 'u', 't']),
    width: length(),
    depth: length(),
    notchWidth: length().optional(),
    notchDepth: length().optional(),
    barDepth: length().optional(),
    stemWidth: length().optional(),
    name: z.string().default('floor'),
    thickness: length().default(EXTERIOR_THICKNESS),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = args.level ?? Object.keys(draft.levels)[0]
    if (!level || !draft.levels[level]) {
      throw new CommandError(`floor-shape: unknown level ${args.level ?? '<none>'}`)
    }
    if (Object.values(draft.walls).some((wall) => wall.level === level)) {
      throw new CommandError('floor-shape: this level already has walls')
    }

    const points = outline(args)
    const height = draft.levels[level].height

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
    const centre = centroidOf(points, shoelace(points) / 2)
    const roomId = allocateId(draft.rooms, 'r')
    draft.rooms[roomId] = { id: roomId, level, x: centre.x, y: centre.y, name: args.name }
    if (area === 0) throw new CommandError('floor-shape: that shape encloses nothing')
  },
})

type Args = {
  kind: 'rectangle' | 'l' | 'u' | 't'
  width: number
  depth: number
  notchWidth?: number
  notchDepth?: number
  barDepth?: number
  stemWidth?: number
}

function outline(args: Args) {
  const spec = specOf(args)
  try {
    return outlinePoints(spec)
  } catch (error) {
    throw new CommandError(`floor-shape: ${(error as Error).message}`)
  }
}

function specOf(args: Args): OutlineSpec {
  const { kind, width, depth } = args

  if (kind === 'rectangle') return { kind, width, depth }

  if (kind === 'l' || kind === 'u') {
    if (args.notchWidth === undefined || args.notchDepth === undefined) {
      throw new CommandError(`floor-shape: an ${kind} needs --notch-width and --notch-depth`)
    }
    return { kind, width, depth, notchWidth: args.notchWidth, notchDepth: args.notchDepth }
  }

  if (args.barDepth === undefined || args.stemWidth === undefined) {
    throw new CommandError('floor-shape: a t needs --bar-depth and --stem-width')
  }
  return { kind, width, depth, barDepth: args.barDepth, stemWidth: args.stemWidth }
}

function shoelace(points: { x: number; y: number }[]): number {
  let total = 0
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!
    const b = points[(i + 1) % points.length]!
    total += a.x * b.y - b.x * a.y
  }
  return total
}
