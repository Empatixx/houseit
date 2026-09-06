import type { HouseDocument, Side } from '@houseit/core/document'
import { wallBetween } from '@houseit/geometry/boundary'
import type { Room } from '@houseit/geometry/rooms'
import { wallsOnSide } from '@houseit/geometry/sides'
import type { Draft } from 'immer'
import { allocateId } from './allocate-id'
import { CommandError } from './command-error'
import { nodeAtOrNew, wallUnder } from './partition'

export const CORNERS = {
  'north-west': { west: true, north: true },
  'north-east': { west: false, north: true },
  'south-west': { west: true, north: false },
  'south-east': { west: false, north: false },
} as const

export type Corner = keyof typeof CORNERS

export type Cut = {
  taken: { x: number; y: number }
  left: { x: number; y: number }
}

export function cutCorner(
  draft: Draft<HouseDocument>,
  level: string,
  room: Room,
  corner: Corner,
  size: {
    width: number
    depth: number
    thickness: number
    notch?: { width: number; depth: number }
  },
): Cut {
  const points = room.nodes.map((node) => draft.nodes[node]!).filter((point) => point)
  const x0 = Math.min(...points.map((point) => point.x))
  const x1 = Math.max(...points.map((point) => point.x))
  const y0 = Math.min(...points.map((point) => point.y))
  const y1 = Math.max(...points.map((point) => point.y))

  if (size.width >= x1 - x0) {
    throw new CommandError(`add-room: wider than ${room.name}, which is ${x1 - x0} mm across`)
  }
  if (size.depth >= y1 - y0) {
    throw new CommandError(
      `add-room: deeper than ${room.name}, which is ${y1 - y0} mm front to back`,
    )
  }
  const notch = size.notch ?? { width: 0, depth: 0 }
  if (notch.width >= size.width || notch.depth >= size.depth) {
    throw new CommandError('add-room: the notch is bigger than the room it is taken out of')
  }

  const { west, north } = CORNERS[corner]
  const sx = west ? 1 : -1
  const sy = north ? -1 : 1
  const edgeX = west ? x0 : x1
  const edgeY = north ? y1 : y0
  const at = (across: number, into: number) => ({ x: edgeX + sx * across, y: edgeY + sy * into })

  const meets = at(size.width, 0)
  const turns = at(0, size.depth)

  const wallAcross = under(draft, level, room, north ? 'north' : 'south', meets)
  const wallAlong = under(draft, level, room, west ? 'west' : 'east', turns)
  if (!wallAcross || !wallAlong) {
    throw new CommandError(
      `add-room: ${room.name} has no ${corner} corner left to take — that side has already been cut back`,
    )
  }

  const path = [
    meets,
    at(size.width, size.depth - notch.depth),
    at(size.width - notch.width, size.depth - notch.depth),
    at(size.width - notch.width, size.depth),
    turns,
  ]

  const ends = path.map((point) => nodeAtOrNew(draft, level, point))

  for (let i = 0; i < ends.length - 1; i += 1) {
    if (ends[i] === ends[i + 1]) continue
    if (wallBetween(draft, level, ends[i]!, ends[i + 1]!)) continue
    const middle = {
      x: (path[i]!.x + path[i + 1]!.x) / 2,
      y: (path[i]!.y + path[i + 1]!.y) / 2,
    }
    if (wallUnder(draft, level, middle)) continue
    const id = allocateId(draft.walls, 'w')
    draft.walls[id] = {
      id,
      level,
      a: ends[i]!,
      b: ends[i + 1]!,
      thickness: size.thickness,
      baseOffset: 0,
      height: draft.levels[level]!.height,
    }
  }

  return {
    taken: at((size.width - notch.width) / 2, size.depth / 2),
    left: {
      x: Math.round((edgeX + sx * size.width + (west ? x1 : x0)) / 2),
      y: Math.round((y0 + y1) / 2),
    },
  }
}

function under(
  draft: Draft<HouseDocument>,
  level: string,
  room: Room,
  side: Side,
  point: { x: number; y: number },
) {
  const between = (value: number, one: number, other: number) =>
    value >= Math.min(one, other) && value <= Math.max(one, other)

  return wallsOnSide(draft, level, room, side).find(
    ({ a, b }) => between(point.x, a.x, b.x) && between(point.y, a.y, b.y),
  )
}
