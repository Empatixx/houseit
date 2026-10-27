import type { HouseDocument, HouseObject } from '@houseit/core/document'
import { layerOf, objectType } from '@houseit/core/object-types'
import { type Box, boxOf, wallBox } from './boxes'
import type { Point } from './outlines'
import type { Room } from './rooms'
import { onPlan, piecesOf, type Spot, standingAt } from './standing'

export type Obstacle = { box: Box; id: string; what: string; wall?: string }
export type Seen = { id?: string; what: string; distance: number }

export const LOOK = 5000

const nameOf = (object: HouseObject) =>
  `the ${objectType(object.type)?.label.toLowerCase() ?? object.type}`

const known = new WeakMap<HouseDocument, Map<string, Obstacle[]>>()

export function obstaclesOn(doc: HouseDocument, level: string, rooms: Room[]): Obstacle[] {
  if (!Object.isFrozen(doc)) return gather(doc, level, rooms)
  const levels = known.get(doc) ?? new Map<string, Obstacle[]>()
  known.set(doc, levels)
  const found = levels.get(level) ?? gather(doc, level, rooms)
  levels.set(level, found)
  return found
}

function gather(doc: HouseDocument, level: string, rooms: Room[]): Obstacle[] {
  const byId = new Map(rooms.filter((room) => room.id).map((room) => [room.id!, room] as const))
  const things = Object.values(doc.objects)
    .filter((object) => object.level === level && layerOf(object.type) === 'floor')
    .flatMap((object) => {
      const room = byId.get(object.room)
      const spot = room && standingAt(doc, level, room, object)
      return spot
        ? piecesOf(spot, object).map((piece) => ({
            box: boxOf(piece),
            id: object.id,
            what: nameOf(object),
          }))
        : []
    })
  const walls = Object.values(doc.walls)
    .filter((wall) => wall.level === level)
    .flatMap((wall) => {
      const a = doc.nodes[wall.a]
      const b = doc.nodes[wall.b]
      return a && b
        ? [{ box: wallBox(a, b, wall.thickness), id: wall.id, what: 'the wall', wall: wall.id }]
        : []
    })
  return [...things, ...walls]
}

function entry(box: Box, from: Point, direction: Point): number | undefined {
  let near = 0
  let far = Number.POSITIVE_INFINITY
  for (const [start, step, low, high] of [
    [from.x, direction.x, box.x0, box.x1],
    [from.y, direction.y, box.y0, box.y1],
  ] as const) {
    if (Math.abs(step) < 1e-9) {
      if (start <= low || start >= high) return undefined
      continue
    }
    const one = (low - start) / step
    const other = (high - start) / step
    near = Math.max(near, Math.min(one, other))
    far = Math.min(far, Math.max(one, other))
  }
  return near < far ? near : undefined
}

export function lookAhead(
  doc: HouseDocument,
  from: Point,
  direction: Point,
  obstacles: Obstacle[],
  except: string[] = [],
): Seen | undefined {
  let best: { obstacle: Obstacle; distance: number } | undefined
  for (const obstacle of obstacles) {
    if (except.includes(obstacle.id)) continue
    const distance = entry(obstacle.box, from, direction)
    if (distance === undefined || distance > LOOK) continue
    if (!best || distance < best.distance) best = { obstacle, distance }
  }
  if (!best) return undefined
  const { obstacle, distance } = best
  const hit = { x: from.x + direction.x * distance, y: from.y + direction.y * distance }
  const opening = obstacle.wall ? openingAt(doc, obstacle.wall, hit) : undefined
  return {
    ...(opening ? { id: opening.id } : obstacle.wall ? {} : { id: obstacle.id }),
    what: opening ? `the ${opening.kind}` : obstacle.what,
    distance: Math.max(0, Math.round(distance)),
  }
}

function openingAt(doc: HouseDocument, wallId: string, hit: Point) {
  const wall = doc.walls[wallId]
  const a = wall && doc.nodes[wall.a]
  const b = wall && doc.nodes[wall.b]
  if (!a || !b) return undefined
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1
  const along = ((hit.x - a.x) * (b.x - a.x) + (hit.y - a.y) * (b.y - a.y)) / length
  return Object.values(doc.openings).find(
    (opening) =>
      opening.wall === wallId && Math.abs(along - opening.t * length) <= opening.width / 2,
  )
}

export const COMPASS = (direction: Point): 'north' | 'south' | 'east' | 'west' =>
  Math.abs(direction.x) > Math.abs(direction.y)
    ? direction.x > 0
      ? 'east'
      : 'west'
    : direction.y > 0
      ? 'north'
      : 'south'

export function frontOf(spot: Spot, size: { width: number; depth: number }) {
  const from = onPlan(spot, size, { x: size.width / 2, y: size.depth })
  return { from, direction: { x: -Math.sin(spot.turn), y: Math.cos(spot.turn) } }
}

export const said = (seen: Seen | undefined) =>
  seen
    ? `${seen.what}${seen.id ? ` ${seen.id}` : ''} ${seen.distance} mm ahead`
    : `open floor for ${LOOK / 1000} m or more`
