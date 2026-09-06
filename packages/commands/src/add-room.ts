import type { HouseDocument } from '@houseit/core/document'
import { FLOOR_MATERIAL_IDS } from '@houseit/core/floor-materials'
import { ROOM_KIND_IDS } from '@houseit/core/room-kinds'
import { anchorInside } from '@houseit/geometry/anchor'
import type { Axis } from '@houseit/geometry/cut'
import { type OutlineSpec, outlinePoints, type Point, walkPoints } from '@houseit/geometry/outlines'
import { containsPoint, type Room, roomsOf } from '@houseit/geometry/rooms'
import { sideRun } from '@houseit/geometry/sides'
import type { Draft as ImmerDraft } from 'immer'
import { z } from 'zod'
import { allocateId } from './allocate-id'
import { type Along, along, fractionOf } from './along-schema'
import { CommandError } from './command-error'
import { CORNERS, type Corner, cutCorner } from './cut-corner'
import { defineCommand } from './define-command'
import { parseLength } from './length'
import { length } from './length-schema'
import { parseWalk } from './parse-walk'
import { linkPoints, nearWall, partitionAlong } from './partition'
import { levelOf, roomNamed, SIDE_NAMES, sideNamed, whereRoom } from './resolve'

const PARTITION_THICKNESS = 150
const EXTERIOR_THICKNESS = 300

const SIDES = {
  west: { axis: 'x', fromLow: true },
  east: { axis: 'x', fromLow: false },
  south: { axis: 'y', fromLow: true },
  north: { axis: 'y', fromLow: false },
} as const satisfies Record<string, { axis: Axis; fromLow: boolean }>

const HEADINGS = { n: { x: 0, y: 1 }, s: { x: 0, y: -1 }, e: { x: 1, y: 0 }, w: { x: -1, y: 0 } }

export const addRoom = defineCommand({
  name: 'add-room',
  summary: `Draw the floor's outline (--shape rectangle|l|u|t, or --walk), or cut a room out of a room: a strip off a --side, a box out of a --corner, --points round it, or a --walk from a side (${FLOOR_MATERIAL_IDS.join(', ')})`,
  args: z.object({
    name: z.string().min(1),
    from: z.string().min(1).optional(),
    shape: z.enum(['rectangle', 'l', 'u', 't']).optional(),
    kind: z.enum(ROOM_KIND_IDS as [string, ...string[]]).optional(),
    side: z.enum(SIDE_NAMES).optional(),
    corner: z.enum(Object.keys(CORNERS) as [Corner, ...Corner[]]).optional(),
    width: length().optional(),
    depth: length().optional(),
    material: z.enum(FLOOR_MATERIAL_IDS as [string, ...string[]]),
    notchWidth: length().optional(),
    notchDepth: length().optional(),
    barDepth: length().optional(),
    stemWidth: length().optional(),
    points: z.string().min(1).optional(),
    walk: z.string().min(1).optional(),
    along: along().optional(),
    thickness: length().optional(),
    level: z.string().optional(),
  }),
  run: (draft, args, open) => {
    const cutting =
      args.from !== undefined ||
      args.side !== undefined ||
      args.corner !== undefined ||
      args.points !== undefined

    if (!cutting) {
      const made = drawOutline(draft, levelOf(draft, args.level ?? open, 'add-room'), {
        ...args,
        thickness: args.thickness ?? EXTERIOR_THICKNESS,
      })
      return named(draft, made, args.kind)
    }

    if (args.shape !== undefined) {
      throw new CommandError(
        'add-room: --shape draws the floor itself; a room inside one is cut with --side, --corner, --points or --walk',
      )
    }
    const cut = { ...args, thickness: args.thickness ?? PARTITION_THICKNESS }
    const ways = [args.side, args.corner, args.points, args.walk].filter((way) => way !== undefined)
    if (
      ways.length !== 1 &&
      !(args.walk !== undefined && ways.length === 2 && args.side !== undefined)
    ) {
      throw new CommandError(
        'add-room: say one shape — a --side to cut a strip off, a --corner to take a box out of, --points round it, or a --walk from a side',
      )
    }

    if (args.points !== undefined) {
      const level =
        cut.from === undefined
          ? levelOf(draft, args.level ?? open, 'add-room')
          : whereRoom(draft, args.level, cut.from, 'add-room').level
      return named(draft, cutByPoints(draft, level, cut, parsePoints(args.points)), args.kind)
    }

    if (cut.from === undefined) {
      throw new CommandError('add-room: say which room it comes out of, with --from')
    }
    const { room: source, level } = whereRoom(draft, args.level, cut.from, 'add-room')

    if (args.walk !== undefined) {
      return named(draft, cutByWalk(draft, level, source, cut), args.kind)
    }

    const width = args.width ?? (args.corner === undefined ? args.depth : undefined)
    if (width === undefined) {
      throw new CommandError('add-room: a strip needs a --width or a --depth; a box needs both')
    }

    if (args.corner) {
      if (args.depth === undefined) {
        throw new CommandError('add-room: a corner needs a depth as well as a width')
      }
      if ((args.notchWidth === undefined) !== (args.notchDepth === undefined)) {
        throw new CommandError('add-room: a notch needs both --notch-width and --notch-depth')
      }
      const corner = cutCorner(draft, level, source, args.corner, {
        width,
        depth: args.depth,
        thickness: cut.thickness,
        ...(args.notchWidth !== undefined && args.notchDepth !== undefined
          ? { notch: { width: args.notchWidth, depth: args.notchDepth } }
          : {}),
      })
      const made = settle(draft, level, source, args.name, args.material, corner.taken, corner.left)
      return named(draft, made, args.kind)
    }

    const { axis, fromLow } = SIDES[args.side!]
    const points = source.nodes.map((id) => draft.nodes[id]!)
    const low = Math.min(...points.map((point) => point[axis]))
    const high = Math.max(...points.map((point) => point[axis]))

    if (width >= high - low) {
      throw new CommandError(
        `add-room: ${args.name} is wider than ${args.from}, which is only ${high - low} mm across`,
      )
    }
    const at = fromLow ? low + width : high - width

    partitionAlong(draft, level, source, axis, at, cut.thickness, 'add-room')
    const made = settleCut(draft, level, source, args.name, args.material, axis, at, fromLow)
    return named(draft, made, args.kind)
  },
})

function drawOutline(
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
  draft.rooms[id] = { id, level, x: centre.x, y: centre.y, name: args.name, floor: args.material }
  return [id]
}

function named(
  draft: ImmerDraft<HouseDocument>,
  made: string[],
  kind: string | undefined,
): { changed: string[] } {
  const first = made[0]
  const record = first === undefined ? undefined : draft.rooms[first]
  if (kind !== undefined && record) record.kind = kind
  return { changed: made }
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

type Draft = Parameters<typeof roomsOf>[0]

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

function cutByPoints(
  draft: Draft,
  level: string,
  args: { name: string; from?: string; material: string; thickness: number },
  corners: Point[],
): string[] {
  const polygon = corners.map((corner) => nearWall(draft, level, corner) ?? corner)
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

function cutByWalk(
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

function settlePieces(
  draft: Draft,
  level: string,
  source: Room & { id: string },
  outline: Point[],
  name: string,
  material: string,
  isNew: ((anchor: Point) => boolean) | undefined,
): string[] {
  const pieces = roomsOf(draft, level)
    .map((face) => ({
      face,
      anchor: anchorInside(
        face.nodes.map((node) => draft.nodes[node]!),
        face.area,
      ),
    }))
    .filter(({ anchor }) => containsPoint(outline, anchor.x, anchor.y))
  if (pieces.length < 2) throw new CommandError('add-room: the walls closed no room off')

  const smallest = pieces.reduce((best, next) => (next.face.area < best.face.area ? next : best))
  const taken = pieces.filter(({ anchor }) => (isNew ? isNew(anchor) : false))
  const fresh = taken.length > 0 ? taken : [smallest]
  const rest = pieces.filter((piece) => !fresh.includes(piece))
  if (rest.length === 0) throw new CommandError('add-room: nothing of the old room would be left')

  const biggest = rest.reduce((best, next) => (next.face.area > best.face.area ? next : best))
  const record = draft.rooms[source.id]!
  record.x = biggest.anchor.x
  record.y = biggest.anchor.y

  const made = fresh.map(({ anchor }, index) => {
    const id = allocateId(draft.rooms, 'r')
    draft.rooms[id] = {
      id,
      level,
      ...anchor,
      name: index === 0 ? name : `${name} ${index + 1}`,
      floor: material,
    }
    return id
  })
  const spare = rest
    .filter((piece) => piece !== biggest)
    .map(({ anchor }, index) => {
      const id = allocateId(draft.rooms, 'r')
      draft.rooms[id] = {
        id,
        level,
        ...anchor,
        name: `${source.name ?? 'room'} ${index + 2}`,
        floor: source.floor ?? material,
      }
      return id
    })
  return [...made, ...spare, source.id]
}

function settleCut(
  draft: Draft,
  level: string,
  source: Room,
  name: string,
  material: string,
  axis: Axis,
  at: number,
  fromLow: boolean,
): string[] {
  const faces = roomsOf(draft, level).filter((face) => !face.id || face.id === source.id)
  const near = faces.filter((face) => (fromLow ? face.centre[axis] < at : face.centre[axis] > at))
  const far = faces.filter((face) => !near.includes(face))
  if (near.length === 0 || far.length === 0) {
    throw new CommandError(`add-room: the cut left nothing on one side of it`)
  }

  const inside = (face: Room) =>
    anchorInside(
      face.nodes.map((node) => draft.nodes[node]!),
      face.area,
    )

  const made = near.map((face, index) => {
    const id = allocateId(draft.rooms, 'r')
    draft.rooms[id] = {
      id,
      level,
      ...inside(face),
      name: index === 0 ? name : `${name} ${index + 1}`,
      floor: material,
    }
    return id
  })

  const rest = far.reduce((biggest, face) => (face.area > biggest.area ? face : biggest))
  const previous = source.id ? draft.rooms[source.id] : undefined
  if (previous) {
    const anchor = inside(rest)
    previous.x = anchor.x
    previous.y = anchor.y
  }
  const spare = far
    .filter((face) => face !== rest)
    .map((face, index) => {
      const id = allocateId(draft.rooms, 'r')
      draft.rooms[id] = {
        id,
        level,
        ...inside(face),
        name: `${source.name ?? 'room'} ${index + 2}`,
        floor: source.floor ?? material,
      }
      return id
    })
  return [...made, ...spare, ...(source.id === undefined ? [] : [source.id])]
}

function settle(
  draft: Draft,
  level: string,
  source: { id?: string },
  name: string,
  material: string,
  taken: { x: number; y: number },
  left: { x: number; y: number },
): string[] {
  const id = allocateId(draft.rooms, 'r')
  draft.rooms[id] = { id, level, x: taken.x, y: taken.y, name, floor: material }

  const previous = source.id ? draft.rooms[source.id] : undefined
  if (previous) {
    previous.x = left.x
    previous.y = left.y
  }
  return [id, ...(source.id === undefined ? [] : [source.id])]
}
