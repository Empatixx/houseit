import { FLOOR_MATERIAL_IDS } from '@houseit/core/floor-materials'
import { anchorInside } from '@houseit/geometry/anchor'
import type { Axis } from '@houseit/geometry/cut'
import type { Point } from '@houseit/geometry/outlines'
import { containsPoint, type Room, roomsOf } from '@houseit/geometry/rooms'
import { sideRun } from '@houseit/geometry/sides'
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
import { levelOf, roomNamed, SIDE_NAMES, sideNamed } from './resolve'

const PARTITION_THICKNESS = 150

/** Plans are drawn with +y north, so the compass maps onto the axes directly. */
const SIDES = {
  west: { axis: 'x', fromLow: true },
  east: { axis: 'x', fromLow: false },
  south: { axis: 'y', fromLow: true },
  north: { axis: 'y', fromLow: false },
} as const satisfies Record<string, { axis: Axis; fromLow: boolean }>

const HEADINGS = { n: { x: 0, y: 1 }, s: { x: 0, y: -1 }, e: { x: 1, y: 0 }, w: { x: -1, y: 0 } }

/**
 * A room is cut out of another room, never placed beside one. Cutting settles
 * the shared partition for free: the wall goes in between two nodes split out of
 * the walls it meets, so both rooms are bounded by the one wall. Placing rooms
 * side by side instead would leave two parallel walls with a gap between them.
 *
 * Four ways to say the shape. A strip off a side, the whole way across; a box
 * out of a corner, with a notch out of its inner corner for an L; any shape at
 * all as its corners, `--points "0,0; 4m,0; 4m,3m; 2m,3m; 2m,5m; 0,5m"`, in
 * millimetres or metres from the plan's origin — the south-west corner of a
 * floor drawn from a standard shape; or as a walk of legs from a point on a
 * side of the room it comes out of, `--walk "3m s, 4m e"`, which closes on
 * whatever wall it reaches. The walls drawn are joined to every wall they cross.
 */
export const addRoom = defineCommand({
  name: 'add-room',
  summary: `Cut a new room out of a room: a strip off a side, a box out of a corner, any shape by its corners or by a walk of legs (${FLOOR_MATERIAL_IDS.join(', ')})`,
  args: z.object({
    name: z.string().min(1),
    /** The room it is cut out of. Left out with --points, the room the first corner lies in. */
    from: z.string().min(1).optional(),
    /** A strip off this side, --width (or --depth) across. */
    side: z.enum(SIDE_NAMES).optional(),
    /** A box out of this corner, --width by --depth. */
    corner: z.enum(Object.keys(CORNERS) as [Corner, ...Corner[]]).optional(),
    width: length().optional(),
    /** Only a corner cut needs one: a side cut runs the whole way across. */
    depth: length().optional(),
    /**
     * Required, like on `floor-shape`. A room the plan cannot say the floor of is
     * a room somebody has to come back to, and nobody comes back.
     */
    material: z.enum(FLOOR_MATERIAL_IDS as [string, ...string[]]),
    /** A bite out of a corner room's inner corner, which makes it L-shaped. */
    notchWidth: length().optional(),
    notchDepth: length().optional(),
    /** Any shape, as its corners: "x,y; x,y; …" from the plan's origin, in millimetres or with units. */
    points: z.string().min(1).optional(),
    /** Any shape, as a walk of legs from a point on --side of --from, --along it: "3m s, 4m e". */
    walk: z.string().min(1).optional(),
    /** With --walk: where along that side it starts, a fraction or a length from the west or south end. */
    along: along().optional(),
    thickness: length().default(PARTITION_THICKNESS),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'add-room')
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
      cutByPoints(draft, level, args, parsePoints(args.points))
      return
    }

    if (args.from === undefined) {
      throw new CommandError('add-room: say which room it comes out of, with --from')
    }
    const source = roomNamed(draft, level, args.from, 'add-room')

    if (args.walk !== undefined) {
      cutByWalk(draft, level, source, args)
      return
    }

    // A strip off the north is naturally said by its depth; either word does.
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
        thickness: args.thickness,
        ...(args.notchWidth !== undefined && args.notchDepth !== undefined
          ? { notch: { width: args.notchWidth, depth: args.notchDepth } }
          : {}),
      })
      settle(draft, level, source, args.name, args.material, corner.taken, corner.left)
      return
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

    // The cut runs right across, going round any step in the room: a room that
    // is not a rectangle comes apart along the line all the same, and what is
    // cut off may be L-shaped — which is what an L-shaped room is.
    partitionAlong(draft, level, source, axis, at, args.thickness, 'add-room')
    settleCut(draft, level, source, args.name, args.material, axis, at, fromLow)
  },
})

type Draft = Parameters<typeof roomsOf>[0]

/** Corners as written: "x,y; x,y; …", each in millimetres or with a unit. At least three. */
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

/**
 * Walls round the corners given, each joined to whatever it crosses, and the
 * face they close is the room. Corners near a wall land on it, so "4m,3m"
 * meets a wall drawn at 3 m rather than standing 20 mm off it.
 */
function cutByPoints(
  draft: Draft,
  level: string,
  args: { name: string; from?: string; material: string; thickness: number },
  corners: Point[],
): void {
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

  settlePieces(
    draft,
    level,
    source as Room & { id: string },
    outline,
    args.name,
    args.material,
    (face) => containsPoint(polygon, face.x, face.y),
  )
}

/**
 * A walk of legs from a point on a side of the room, each a wall, the last
 * one let go on whatever wall it reaches. The smaller of what it leaves
 * either side of it is the new room.
 */
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
): void {
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
  // A run stops at the faces of the walls at its ends; a walk from its very
  // end starts at the corner itself.
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

  settlePieces(draft, level, source, outline, args.name, args.material, undefined)
}

/**
 * After walls have been drawn through a room: which of the pieces it came
 * apart into is the new room, and which keeps the old name. Told by a test on
 * a piece's anchor — inside the corners drawn — or, for a walk, the smaller
 * piece. The old record moves into the biggest of the rest, and any further
 * pieces are numbered after whichever name they belong to.
 */
function settlePieces(
  draft: Draft,
  level: string,
  source: Room & { id: string },
  outline: Point[],
  name: string,
  material: string,
  isNew: ((anchor: Point) => boolean) | undefined,
): void {
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

  fresh.forEach(({ anchor }, index) => {
    const id = allocateId(draft.rooms, 'r')
    draft.rooms[id] = {
      id,
      level,
      ...anchor,
      name: index === 0 ? name : `${name} ${index + 1}`,
      floor: material,
    }
  })
  rest
    .filter((piece) => piece !== biggest)
    .forEach(({ anchor }, index) => {
      const id = allocateId(draft.rooms, 'r')
      draft.rooms[id] = {
        id,
        level,
        ...anchor,
        name: `${source.name ?? 'room'} ${index + 2}`,
        floor: source.floor ?? material,
      }
    })
}

/**
 * After a cut right across: whatever lies on the near side of the line is the
 * new room, whatever lies beyond keeps the old name — decided by where each
 * face is, not by where an old anchor happened to fall. A stepped room can
 * come apart into more than two faces; the extra ones on the near side are
 * numbered after the new name.
 */
function settleCut(
  draft: Draft,
  level: string,
  source: Room,
  name: string,
  material: string,
  axis: Axis,
  at: number,
  fromLow: boolean,
): void {
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

  near.forEach((face, index) => {
    const id = allocateId(draft.rooms, 'r')
    draft.rooms[id] = {
      id,
      level,
      ...inside(face),
      name: index === 0 ? name : `${name} ${index + 1}`,
      floor: material,
    }
  })

  const rest = far.reduce((biggest, face) => (face.area > biggest.area ? face : biggest))
  const previous = source.id ? draft.rooms[source.id] : undefined
  if (previous) {
    const anchor = inside(rest)
    previous.x = anchor.x
    previous.y = anchor.y
  }
  far
    .filter((face) => face !== rest)
    .forEach((face, index) => {
      const id = allocateId(draft.rooms, 'r')
      draft.rooms[id] = {
        id,
        level,
        ...inside(face),
        name: `${source.name ?? 'room'} ${index + 2}`,
        floor: source.floor ?? material,
      }
    })
}

/**
 * Records the room that was cut out and moves the one it came from into what is
 * left, rather than letting an old anchor decide which half keeps the name.
 */
function settle(
  draft: Draft,
  level: string,
  source: { id?: string },
  name: string,
  material: string,
  taken: { x: number; y: number },
  left: { x: number; y: number },
): void {
  const id = allocateId(draft.rooms, 'r')
  draft.rooms[id] = { id, level, x: taken.x, y: taken.y, name, floor: material }

  const previous = source.id ? draft.rooms[source.id] : undefined
  if (previous) {
    previous.x = left.x
    previous.y = left.y
  }
}
