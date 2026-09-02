import { addRoom } from '@houseit/commands/add-room'
import { addWall } from '@houseit/commands/add-wall'
import { floorShape } from '@houseit/commands/floor-shape'
import { SNAP } from '@houseit/commands/partition'
import type { Wall } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { SIDES, sideOfWall, sideRun } from '@houseit/geometry/sides'
import { documentStore } from '../store/store'
import { endPreview, previewCommand } from './preview'
import { runEdit } from './run-edit'

/**
 * What draws the shape of the plan: a wall dragged in from a side, a room cut
 * off another, the outline of the floor. Each is the command an agent would
 * give, with what the hand did worked out into the command's words.
 */

/**
 * What `add-wall` is asked for a wall drawn from a point on a wall into the
 * room on the side the pointer went: as far as it was dragged, or right
 * across if it was let go within reach of the far wall.
 */
function drawnWallArgs(wall: Wall, from: Point, shift: Point) {
  const { doc, level } = documentStore.getState()
  const rooms = roomsOf(doc, level)

  // The room the drag went into: of the rooms this wall bounds, the one whose
  // inside lies the way the pointer moved.
  let found: { room: Room & { name: string }; side: keyof typeof SIDES } | undefined
  for (const room of rooms) {
    if (!room.name) continue
    const side = sideOfWall(doc, level, room, wall.id)
    if (!side) continue
    const { axis, low } = SIDES[side]
    const inward = low ? 1 : -1
    if (shift[axis] * inward > 0) {
      found = { room: { ...room, name: room.name }, side }
      break
    }
  }
  if (!found) return undefined

  const run = sideRun(doc, level, found.room, found.side)
  if (!run || run.length === 0) return undefined
  const unit = { x: (run.to.x - run.from.x) / run.length, y: (run.to.y - run.from.y) / run.length }
  const along = ((from.x - run.from.x) * unit.x + (from.y - run.from.y) * unit.y) / run.length
  const { axis } = SIDES[found.side]
  const length = Math.round(Math.abs(shift[axis]) / 10) * 10
  if (length < SNAP) return undefined

  // Let go within reach of the far wall: right across.
  const far = farWallDistance(doc, found.room, found.side, from)
  const across = far !== undefined && far - length <= SNAP

  return {
    room: found.room.name,
    side: found.side,
    along: Math.round(Math.min(1, Math.max(0, along)) * 1000) / 1000,
    ...(across ? {} : { length }),
  }
}

/** Draws the wall the drag described, or says why it cannot be there. */
export function drawWallFrom(wall: Wall, from: Point, shift: Point): boolean {
  const args = drawnWallArgs(wall, from, shift)
  if (!args) return false
  return runEdit(() => documentStore.getState().apply(addWall, args))
}

/** Shows the wall being drawn, and what it would cut off. */
export function previewDrawnWall(wall: Wall, from: Point, shift: Point): void {
  const args = drawnWallArgs(wall, from, shift)
  if (!args) {
    endPreview()
    return
  }
  previewCommand(addWall, args)
}

/** How far it is from a point on one side of a room to the first wall across from it. */
function farWallDistance(
  doc: ReturnType<typeof documentStore.getState>['doc'],
  room: Room,
  side: keyof typeof SIDES,
  from: Point,
): number | undefined {
  const { axis, low } = SIDES[side]
  const direction = low ? 1 : -1
  const across = axis === 'x' ? 'y' : 'x'
  let best: number | undefined
  const count = room.nodes.length
  for (let i = 0; i < count; i += 1) {
    const a = doc.nodes[room.nodes[i]!]
    const b = doc.nodes[room.nodes[(i + 1) % count]!]
    if (!a || !b || a[axis] !== b[axis]) continue
    const lowAcross = Math.min(a[across], b[across])
    const highAcross = Math.max(a[across], b[across])
    if (from[across] < lowAcross || from[across] > highAcross) continue
    const distance = (a[axis] - from[axis]) * direction
    if (distance > 1 && (best === undefined || distance < best)) best = distance
  }
  return best
}

export type CutRequest = {
  where:
    | 'north'
    | 'south'
    | 'east'
    | 'west'
    | 'north-west'
    | 'north-east'
    | 'south-west'
    | 'south-east'
  width: number
  depth?: number
  name: string
  material: string
}

/** Cuts a room off a side, or out of a corner, of a room. */
export function cutRoom(from: Room, cut: CutRequest): boolean {
  if (!from.name) return false
  const corner = cut.where.includes('-')
  return runEdit(() =>
    documentStore.getState().apply(addRoom, {
      name: cut.name,
      from: from.name!,
      ...(corner
        ? { corner: cut.where as 'north-west', depth: cut.depth }
        : { side: cut.where as 'north' }),
      width: cut.width,
      material: cut.material,
    }),
  )
}

export type FloorRequest = {
  kind: 'rectangle' | 'l' | 'u' | 't' | 'walk'
  width?: number
  depth?: number
  notchWidth?: number
  notchDepth?: number
  barDepth?: number
  stemWidth?: number
  walk?: string
  name: string
  material: string
}

/** Draws the outline of an empty floor. */
export function drawFloor(floor: FloorRequest): boolean {
  return runEdit(() =>
    documentStore.getState().apply(floorShape, {
      name: floor.name,
      material: floor.material,
      ...(floor.kind === 'walk'
        ? { walk: floor.walk ?? '' }
        : {
            kind: floor.kind,
            width: floor.width,
            depth: floor.depth,
            ...(floor.kind === 'l' || floor.kind === 'u'
              ? { notchWidth: floor.notchWidth, notchDepth: floor.notchDepth }
              : {}),
            ...(floor.kind === 't' ? { barDepth: floor.barDepth, stemWidth: floor.stemWidth } : {}),
          }),
    }),
  )
}
