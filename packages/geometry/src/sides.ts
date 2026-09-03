import type { HouseDocument, Side } from '@houseit/core/document'
import { boundaryWallsOf, wallBetween } from './boundary'
import type { Point } from './outlines'
import type { Room } from './rooms'

/** The coordinate a wall on that side holds constant, and which end of it to take. */
export const SIDES = {
  west: { axis: 'x', low: true },
  east: { axis: 'x', low: false },
  south: { axis: 'y', low: true },
  north: { axis: 'y', low: false },
} as const satisfies Record<Side, { axis: 'x' | 'y'; low: boolean }>

export const SIDE_NAMES: readonly Side[] = ['north', 'east', 'south', 'west']

export type SideWall = { wall: string; a: Point; b: Point }

/**
 * Every wall of a room that faces one way, wherever it stands. A room walks
 * its face counter-clockwise, so the room lies to the left of each wall, and a
 * wall with the room south of it is a north wall — the one along the room's
 * edge and the one an L steps back to alike. A wall the face walks both ways
 * is a stub hanging into the room and faces nothing; a wall running slantwise
 * is on no side either.
 */
export function wallsFacing(doc: HouseDocument, level: string, room: Room, side: Side): SideWall[] {
  const count = room.nodes.length
  const times = new Map<string, number>()
  const found: SideWall[] = []

  for (let i = 0; i < count; i += 1) {
    const aId = room.nodes[i]!
    const bId = room.nodes[(i + 1) % count]!
    const wall = wallBetween(doc, level, aId, bId)
    if (!wall) continue
    times.set(wall.id, (times.get(wall.id) ?? 0) + 1)
    const a = doc.nodes[aId]
    const b = doc.nodes[bId]
    if (!a || !b || (a.x !== b.x && a.y !== b.y)) continue
    if (sideFacing({ x: -(b.y - a.y), y: b.x - a.x }) !== side) continue
    // In the wall's own order, not the walk's: `t` along a wall is from its `a`.
    found.push({ wall: wall.id, a: doc.nodes[wall.a]!, b: doc.nodes[wall.b]! })
  }
  return found.filter((it) => times.get(it.wall) === 1)
}

export type SideRun = {
  /** The two ends of the run, ordered so that 0 is always the same end. */
  from: Point
  to: Point
  length: number
  /** Which way the room lies from the wall, as a unit step in plan coordinates. */
  inward: Point
  /**
   * The wall's own thickness. A run is its centre line, not its face, so anything
   * put against it has to clear half of this or it stands inside the masonry.
   */
  thickness: number
  /** Which run of its side this is, counting from one, west to east or south to north. */
  nth: number
  /** The walls in it, in that order. */
  walls: SideWall[]
}

/**
 * The runs along one side of a room: each a stretch of wall in one line that
 * things are put along.
 *
 * A rectangle has one to a side. A side split into two walls by a partition
 * landing on it is still one run — the walls are in line and touch — but where
 * a room steps, as an L does, the side is two runs at two depths, and where it
 * is cut back, as a U is, the two ends of the same line are two runs with the
 * gap between them. Ordered west to east, or south to north, so a run's number
 * means the same thing every time it is read.
 */
export function sideRuns(doc: HouseDocument, level: string, room: Room, side: Side): SideRun[] {
  const { axis } = SIDES[side]
  const along = axis === 'x' ? 'y' : 'x'
  const lowEnd = (wall: SideWall) => Math.min(wall.a[along], wall.b[along])
  const highEnd = (wall: SideWall) => Math.max(wall.a[along], wall.b[along])

  const sorted = [...wallsFacing(doc, level, room, side)].sort(
    (one, other) => one.a[axis] - other.a[axis] || lowEnd(one) - lowEnd(other),
  )
  const groups: SideWall[][] = []
  for (const wall of sorted) {
    const last = groups.at(-1)
    const tail = last?.at(-1)
    if (last && tail && tail.a[axis] === wall.a[axis] && highEnd(tail) >= lowEnd(wall)) {
      last.push(wall)
    } else {
      groups.push([wall])
    }
  }

  return groups
    .map((walls) => runOf(doc, level, room, side, walls))
    .sort((one, other) => one.from[along] - other.from[along])
    .map((run, index) => ({ ...run, nth: index + 1 }))
}

function runOf(
  doc: HouseDocument,
  level: string,
  room: Room,
  side: Side,
  walls: SideWall[],
): Omit<SideRun, 'nth'> {
  const { axis, low } = SIDES[side]
  const along = axis === 'x' ? 'y' : 'x'
  const reach = walls.flatMap(({ a, b }) => [a, b])
  const end = reach.reduce((lowest, next) => (next[along] < lowest[along] ? next : lowest))
  const far = reach.reduce((highest, next) => (next[along] > highest[along] ? next : highest))
  const first = walls.find((wall) => wall.a === end || wall.b === end) ?? walls[0]!
  const last = walls.find((wall) => wall.a === far || wall.b === far) ?? walls[0]!
  const longest = walls.reduce((best, next) => (lengthOf(next) > lengthOf(best) ? next : best))
  const step = low ? 1 : -1

  // A corner is the middle of the wall turning it, so the run has to stop at that
  // wall's face and not at its centre line. Left at the centre lines, everything
  // spread along the side has its ends buried in the masonry either side of it —
  // which is exactly where the bedside table ended up.
  const near = crossingHalf(doc, level, room, first.wall, end)
  const beyond = crossingHalf(doc, level, room, last.wall, far)
  const way = { x: Math.sign(far.x - end.x), y: Math.sign(far.y - end.y) }
  const from = { x: end.x + way.x * near, y: end.y + way.y * near }
  const to = { x: far.x - way.x * beyond, y: far.y - way.y * beyond }

  return {
    from,
    to,
    length: Math.round(Math.hypot(to.x - from.x, to.y - from.y)),
    inward: axis === 'x' ? { x: step, y: 0 } : { x: 0, y: step },
    thickness: doc.walls[longest.wall]?.thickness ?? 0,
    walls,
  }
}

/**
 * The line something placed against a side is placed along: the run asked for
 * by number, or the longest run of that side — which is the only one a
 * rectangle has, and the one somebody means by "the north wall" of an L.
 */
export function sideRun(
  doc: HouseDocument,
  level: string,
  room: Room,
  side: Side,
  nth?: number,
): SideRun | undefined {
  const runs = sideRuns(doc, level, room, side)
  if (nth !== undefined) return runs[nth - 1]
  return runs.reduce<SideRun | undefined>(
    (best, next) => (best === undefined || next.length > best.length ? next : best),
    undefined,
  )
}

/** The walls of one run along a side: the run asked for, or the longest. */
export function wallsOnSide(
  doc: HouseDocument,
  level: string,
  room: Room,
  side: Side,
  nth?: number,
): SideWall[] {
  return sideRun(doc, level, room, side, nth)?.walls ?? []
}

/** The longest wall of that run. */
export function wallOnSide(
  doc: HouseDocument,
  level: string,
  room: Room,
  side: Side,
  nth?: number,
): SideWall | undefined {
  const walls = wallsOnSide(doc, level, room, side, nth)
  if (walls.length === 0) return undefined
  return walls.reduce((best, next) => (lengthOf(next) > lengthOf(best) ? next : best))
}

/** Where a wall of a room is, said the way a command takes it: its side, and which run of that side. */
export type WallPlace = { side: Side; nth: number /** How many runs the side has. */; of: number }

/** Which side of a room a wall is on and which run of it, or nothing for a wall the room does not walk. */
export function runOfWall(
  doc: HouseDocument,
  level: string,
  room: Room,
  wallId: string,
): WallPlace | undefined {
  for (const side of SIDE_NAMES) {
    const runs = sideRuns(doc, level, room, side)
    const run = runs.find((candidate) => candidate.walls.some((wall) => wall.wall === wallId))
    if (run) return { side, nth: run.nth, of: runs.length }
  }
  return undefined
}

/** Half the thickness of the thickest wall of the room turning that corner. */
function crossingHalf(
  doc: HouseDocument,
  level: string,
  room: Room,
  wall: string,
  corner: Point,
): number {
  const thickest = boundaryWallsOf(doc, level, room)
    .filter((other) => other.id !== wall)
    .filter((other) =>
      [doc.nodes[other.a], doc.nodes[other.b]].some(
        (node) => node && node.x === corner.x && node.y === corner.y,
      ),
    )
    .reduce((most, other) => Math.max(most, other.thickness), 0)

  return thickest / 2
}

const lengthOf = ({ a, b }: SideWall) => Math.round(Math.hypot(b.x - a.x, b.y - a.y))

/**
 * Which side of a room a wall of it lies on, read off the way the room's face
 * walks it: faces run counter-clockwise, so the room is on the left of every
 * edge, and a wall with the room lying south of it is the north wall. Nothing
 * for a wall the room does not walk.
 */
export function sideOfWall(
  doc: HouseDocument,
  level: string,
  room: Room,
  wallId: string,
): Side | undefined {
  const wall = doc.walls[wallId]
  if (!wall || wall.level !== level) return undefined
  const count = room.nodes.length

  for (let i = 0; i < count; i += 1) {
    const aId = room.nodes[i]!
    const bId = room.nodes[(i + 1) % count]!
    const walked = (wall.a === aId && wall.b === bId) || (wall.a === bId && wall.b === aId)
    if (!walked) continue
    const a = doc.nodes[aId]
    const b = doc.nodes[bId]
    if (!a || !b) continue
    return sideFacing({ x: -(b.y - a.y), y: b.x - a.x })
  }
  return undefined
}

/** The side a wall is on, from the way it faces into its room: facing south, it is the north wall. */
export function sideFacing(inward: Point): Side {
  if (Math.abs(inward.y) >= Math.abs(inward.x)) return inward.y < 0 ? 'north' : 'south'
  return inward.x < 0 ? 'east' : 'west'
}
