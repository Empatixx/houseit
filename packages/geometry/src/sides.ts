import type { HouseDocument, Side } from '@houseit/core/document'
import { boundaryWallsOf, wallBetween } from './boundary'
import type { Point } from './outlines'
import type { Room } from './rooms'

export const SIDES = {
  west: { axis: 'x', low: true },
  east: { axis: 'x', low: false },
  south: { axis: 'y', low: true },
  north: { axis: 'y', low: false },
} as const satisfies Record<Side, { axis: 'x' | 'y'; low: boolean }>

export const SIDE_NAMES: readonly Side[] = ['north', 'east', 'south', 'west']

export type SideWall = { wall: string; a: Point; b: Point }

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
    found.push({ wall: wall.id, a: doc.nodes[wall.a]!, b: doc.nodes[wall.b]! })
  }
  return found.filter((it) => times.get(it.wall) === 1)
}

export type SideRun = {
  from: Point
  to: Point
  length: number
  inward: Point
  thickness: number
  nth: number
  walls: SideWall[]
}

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

export function wallsOnSide(
  doc: HouseDocument,
  level: string,
  room: Room,
  side: Side,
  nth?: number,
): SideWall[] {
  return sideRun(doc, level, room, side, nth)?.walls ?? []
}

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

export function stretchOf(run: SideRun, wallId: string): { from: number; to: number } | undefined {
  const wall = run.walls.find((it) => it.wall === wallId)
  if (!wall) return undefined
  const unit = {
    x: (run.to.x - run.from.x) / (run.length || 1),
    y: (run.to.y - run.from.y) / (run.length || 1),
  }
  const at = (point: Point) => (point.x - run.from.x) * unit.x + (point.y - run.from.y) * unit.y
  const ends = [at(wall.a), at(wall.b)]
  return {
    from: Math.max(0, Math.round(Math.min(...ends))),
    to: Math.min(run.length, Math.round(Math.max(...ends))),
  }
}

export type WallPlace = { side: Side; nth: number; of: number }

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

export function sideFacing(inward: Point): Side {
  if (Math.abs(inward.y) >= Math.abs(inward.x)) return inward.y < 0 ? 'north' : 'south'
  return inward.x < 0 ? 'east' : 'west'
}
