import type { HouseDocument, HouseObject, Opening, Side, Wall } from '@houseit/core/document'
import { PARTS, type Part } from '@houseit/core/finishes'
import { boundaryWallsOf } from '@houseit/geometry/boundary'
import { interiorSize, objectClearances, planExtent } from '@houseit/geometry/dimensions'
import type { Point } from '@houseit/geometry/outlines'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import {
  runOfWall,
  SIDE_NAMES,
  type SideRun,
  sideOfWall,
  sideRun,
  sideRuns,
  stretchOf,
  wallsOnSide,
} from '@houseit/geometry/sides'
import { freeSpans } from '@houseit/geometry/spans'
import { footprintOf, standingAt } from '@houseit/geometry/standing'
import { wellsInRoom } from '@houseit/geometry/wells'
import { hasDoor, opensIntoOf } from './opening-direction'
import { handOf } from './opening-hinge'
import { order } from './resolve'

export type WallReport = {
  id: string
  side: Side
  nth?: number
  length: number
  thickness: number
  exterior?: Wall['exterior']
}

export type OpeningReport = {
  id: string
  kind: Opening['kind']
  wall: string
  side: Side
  along: number
  width: number
  height: number
  panels?: Opening['panels']
  frame?: Opening['frame']
  variant?: Opening['variant']
  hinge?: 'left' | 'right'
  opensInto?: string
  sill?: number
  to?: string
}

export type ObjectReport = {
  id: string
  type: string
  against?: Side
  wall?: string
  along: number
  across?: number
  rotation?: number
  seats?: number
  width: number
  depth: number
  surface: string
  at?: Point
  clear?: Record<string, number>
}

export type Span = { from: number; to: number }

export type SideReport = {
  side: Side
  nth?: number
  walls: (Span & { id: string })[]
  length: number
  thickness: number
  openings: (Span & { id: string; kind: Opening['kind'] })[]
  objects: (Span & { id: string; type: string })[]
  free: Span[]
}

function dressingOf(
  record:
    | { style?: string; walls?: string; ceiling?: string; doors?: string; windows?: string }
    | undefined,
): { style?: string; finishes?: Partial<Record<Part, string>> } {
  if (!record) return {}
  const finishes: Partial<Record<Part, string>> = {}
  for (const part of PARTS) {
    const finish = record[part]
    if (finish !== undefined) finishes[part] = finish
  }
  return {
    ...(record.style === undefined ? {} : { style: record.style }),
    ...(Object.keys(finishes).length === 0 ? {} : { finishes }),
  }
}

export type RoomReport = {
  id?: string
  name?: string
  kind?: string
  areaM2: number
  width: number
  depth: number
  box: { x0: number; y0: number; x1: number; y1: number }
  floor?: string
  style?: string
  finishes?: Partial<Record<Part, string>>
  neighbours: string[]
  walls: WallReport[]
  sides: SideReport[]
  wells?: {
    object: string
    type: string
    box: { x0: number; y0: number; x1: number; y1: number }
  }[]
  openings: OpeningReport[]
  objects: ObjectReport[]
}

export type LevelReport = {
  level: string
  width?: number
  depth?: number
  rooms: RoomReport[]
}

export function surveyLevel(doc: HouseDocument, level: string): LevelReport {
  const rooms = roomsOf(doc, level)
  const extent = planExtent(doc, level)
  return {
    level,
    ...(extent
      ? { width: Math.round(extent.x1 - extent.x0), depth: Math.round(extent.y1 - extent.y0) }
      : {}),
    rooms: rooms.map((room) => surveyRoom(doc, level, room, rooms)),
  }
}

export function surveyRoom(
  doc: HouseDocument,
  level: string,
  room: Room,
  rooms: Room[] = roomsOf(doc, level),
): RoomReport {
  const corners = room.nodes.map((id) => doc.nodes[id]).filter((node) => node !== undefined)
  const xs = corners.map((corner) => corner.x)
  const ys = corners.map((corner) => corner.y)
  const walls = boundaryWallsOf(doc, level, room)
  const walled = new Set(walls.map((wall) => wall.id))
  const found = Object.values(doc.openings)
    .filter((opening) => walled.has(opening.wall))
    .sort((one, other) => order(one.id) - order(other.id))

  const openings: OpeningReport[] = []
  for (const opening of found) {
    const wall = doc.walls[opening.wall]
    const side = sideOfWall(doc, level, room, opening.wall)
    if (!wall || !side) continue
    const across = rooms.find((other) => !sameFace(other, room) && walks(other, wall))
    openings.push({
      id: opening.id,
      kind: opening.kind,
      wall: opening.wall,
      side,
      along: alongSide(doc, level, room, side, wall, opening.t),
      width: opening.width,
      height: opening.height,
      ...(opening.panels ? { panels: opening.panels } : {}),
      ...(opening.frame ? { frame: opening.frame } : {}),
      ...(hasDoor(opening) && opening.variant === 'hinged'
        ? {
            hinge: handOf(opening),
            opensInto: opensIntoOf(doc, rooms, opening),
          }
        : {}),
      ...(opening.kind === 'door' || opening.panels?.some((p) => p.kind === 'door')
        ? { variant: opening.variant, to: across ? (across.name ?? '(unnamed)') : 'outside' }
        : { sill: opening.sillHeight }),
    })
  }

  const neighbours = rooms
    .filter((other) => !sameFace(other, room) && walls.some((wall) => walks(other, wall)))
    .map((other) => other.name)
    .filter((name) => name !== undefined)

  const objects = objectsIn(doc, level, room)

  return {
    ...(room.id === undefined ? {} : { id: room.id }),
    ...(room.name === undefined ? {} : { name: room.name }),
    ...(room.kind === undefined ? {} : { kind: room.kind }),
    areaM2: Math.round(room.clear / 10_000) / 100,
    ...interiorSize(doc, level, room),
    box: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) },
    ...(room.floor === undefined ? {} : { floor: room.floor }),
    ...dressingOf(room.id === undefined ? undefined : doc.rooms[room.id]),
    neighbours,
    walls: walls.flatMap((wall) => {
      const place = runOfWall(doc, level, room, wall.id)
      const a = doc.nodes[wall.a]
      const b = doc.nodes[wall.b]
      if (!place || !a || !b) return []
      return [
        {
          id: wall.id,
          side: place.side,
          ...(place.of > 1 ? { nth: place.nth } : {}),
          length: Math.round(Math.hypot(b.x - a.x, b.y - a.y)),
          thickness: wall.thickness,
          ...(wall.exterior ? { exterior: wall.exterior } : {}),
        },
      ]
    }),
    wells: pierced(doc, level, room),
    sides: SIDE_NAMES.flatMap((side) => {
      const runs = sideRuns(doc, level, room, side)
      return runs.map((run) => surveySide(doc, level, room, side, run, runs.length > 1, objects))
    }),
    openings,
    objects: objects.map((object) => surveyObject(doc, level, room, object)),
  }
}

function pierced(doc: HouseDocument, level: string, room: Room): RoomReport['wells'] {
  const wells = wellsInRoom(doc, level, room)
  if (wells.length === 0) return undefined
  return wells.map((well) => {
    const xs = well.outline.map((corner) => corner.x)
    const ys = well.outline.map((corner) => corner.y)
    return {
      object: well.object,
      type: well.type,
      box: {
        x0: Math.round(Math.min(...xs)),
        y0: Math.round(Math.min(...ys)),
        x1: Math.round(Math.max(...xs)),
        y1: Math.round(Math.max(...ys)),
      },
    }
  })
}

export function surveySide(
  doc: HouseDocument,
  level: string,
  room: Room,
  side: Side,
  run: SideRun,
  numbered: boolean,
  among: HouseObject[] = objectsIn(doc, level, room),
): SideReport {
  const length = run.length || 1
  const unit = { x: (run.to.x - run.from.x) / length, y: (run.to.y - run.from.y) / length }
  const project = (point: Point) =>
    (point.x - run.from.x) * unit.x + (point.y - run.from.y) * unit.y

  const walls = run.walls.flatMap((wall) => {
    const stretch = stretchOf(run, wall.wall)
    return stretch === undefined
      ? []
      : [{ id: wall.wall, from: Math.round(stretch.from), to: Math.round(stretch.to) }]
  })
  const held = new Set(run.walls.map((wall) => wall.wall))
  const openings = Object.values(doc.openings)
    .filter((opening) => held.has(opening.wall))
    .sort((one, other) => order(one.id) - order(other.id))
    .flatMap((opening) => {
      const wall = doc.walls[opening.wall]
      const a = wall && doc.nodes[wall.a]
      const b = wall && doc.nodes[wall.b]
      if (!a || !b) return []
      const centre = project({ x: a.x + (b.x - a.x) * opening.t, y: a.y + (b.y - a.y) * opening.t })
      return [
        {
          id: opening.id,
          kind: opening.kind,
          from: Math.round(centre - opening.width / 2),
          to: Math.round(centre + opening.width / 2),
        },
      ]
    })

  const longest = sideRun(doc, level, room, side)
  const objects = among
    .filter((object) => object.against === side && (object.againstNth ?? longest?.nth) === run.nth)
    .flatMap((object) => {
      const spot = standingAt(doc, level, room, object)
      if (!spot) return []
      const reach = footprintOf(spot, object).map(project)
      return [
        {
          id: object.id,
          type: object.type,
          from: Math.round(Math.min(...reach)),
          to: Math.round(Math.max(...reach)),
        },
      ]
    })

  const taken = [...openings, ...objects].map(({ from, to }) => ({ from, to }))
  return {
    side,
    ...(numbered ? { nth: run.nth } : {}),
    walls,
    length: run.length,
    thickness: run.thickness,
    openings,
    objects,
    free: freeSpans(run.length, taken).map((span) => ({
      from: Math.round(span.from),
      to: Math.round(span.to),
    })),
  }
}

export function objectsIn(doc: HouseDocument, level: string, room: Room): HouseObject[] {
  return Object.values(doc.objects)
    .filter((object) => object.level === level && object.room === room.id)
    .sort((one, other) => order(one.id) - order(other.id))
}

export function surveyObject(
  doc: HouseDocument,
  level: string,
  room: Room,
  object: HouseObject,
): ObjectReport {
  const spot = standingAt(doc, level, room, object)
  const run = object.against
    ? sideRun(doc, level, room, object.against, object.againstNth)
    : undefined
  const backing = run?.walls.reduce((best, next) =>
    Math.hypot(next.b.x - next.a.x, next.b.y - next.a.y) >
    Math.hypot(best.b.x - best.a.x, best.b.y - best.a.y)
      ? next
      : best,
  )
  return {
    id: object.id,
    type: object.type,
    ...(object.against === undefined ? {} : { against: object.against }),
    ...(backing === undefined ? {} : { wall: backing.wall }),
    along: object.along,
    ...(object.across === undefined ? {} : { across: object.across }),
    ...(object.rotation === undefined ? {} : { rotation: object.rotation }),
    ...(object.seats === undefined ? {} : { seats: object.seats }),
    width: object.width,
    depth: object.depth,
    surface: object.surface,
    ...(spot
      ? {
          at: { x: Math.round(spot.at.x), y: Math.round(spot.at.y) },
          clear: Object.fromEntries(
            objectClearances(doc, level, room, spot, object).map((it) => [it.side, it.length]),
          ),
        }
      : {}),
  }
}

const sameFace = (one: Room, other: Room) =>
  one.nodes.length === other.nodes.length &&
  [...one.nodes].sort().join('-') === [...other.nodes].sort().join('-')

function walks(room: Room, wall: Wall): boolean {
  const count = room.nodes.length
  for (let i = 0; i < count; i += 1) {
    const a = room.nodes[i]!
    const b = room.nodes[(i + 1) % count]!
    if ((wall.a === a && wall.b === b) || (wall.a === b && wall.b === a)) return true
  }
  return false
}

function alongSide(
  doc: HouseDocument,
  level: string,
  room: Room,
  side: Side,
  wall: Wall,
  t: number,
): number {
  const a = doc.nodes[wall.a]
  const b = doc.nodes[wall.b]
  if (!a || !b) return 0
  const centre = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }

  const onEdge = wallsOnSide(doc, level, room, side).some((it) => it.wall === wall.id)
  const run = onEdge ? sideRun(doc, level, room, side) : undefined
  const [from, to] = run
    ? [run.from, run.to]
    : a.x === b.x
      ? a.y <= b.y
        ? [a, b]
        : [b, a]
      : a.x <= b.x
        ? [a, b]
        : [b, a]

  const span = (to.x - from.x) ** 2 + (to.y - from.y) ** 2
  if (span === 0) return 0
  const along =
    ((centre.x - from.x) * (to.x - from.x) + (centre.y - from.y) * (to.y - from.y)) / span
  return Math.round(Math.min(1, Math.max(0, along)) * 1000) / 1000
}
