import type { HouseDocument, HouseObject } from '@houseit/core/document'
import { heightOf } from '@houseit/core/heights'
import { CAMERA, layerOf, symbolOf } from '@houseit/core/object-types'
import { isStaircase } from '@houseit/core/stairs'
import { type Surface, surfaceOf } from '@houseit/core/surfaces'
import { containsPoint, roomsOf } from '@houseit/geometry/rooms'
import { footprintOf, type Spot, standingAt } from '@houseit/geometry/standing'
import { paintOf } from './finishes'
import { modelled, piecesOf } from './models'
import { owned, type Piece, put, slab } from './pieces'

const SYMBOL_LIFT = 3

type Standing = { object: HouseObject; spot: Spot; surface: Surface; symbol: string }

export type Placed = Standing & { rest: number }

export function placedOn(doc: HouseDocument, level: string): Placed[] {
  const rooms = new Map(
    roomsOf(doc, level)
      .filter((room) => room.id)
      .map((room) => [room.id!, room] as const),
  )
  const standing = Object.values(doc.objects)
    .filter((object) => object.level === level && object.type !== CAMERA)
    .flatMap<Standing>((object) => {
      const room = rooms.get(object.room)
      const spot = room ? standingAt(doc, level, room, object) : undefined
      const surface = surfaceOf(object.surface)
      if (!spot || !surface) return []
      const symbol = symbolOf(object.type) ?? ''
      if (!symbol && !modelled(object.type)) return []
      return [{ object, spot, surface, symbol }]
    })

  return standing.map((thing) => ({ ...thing, rest: restOf(thing, standing) }))
}

export function furniturePieces(doc: HouseDocument, level: string): Piece[] {
  const storey = doc.levels[level]?.height
  return placedOn(doc, level).flatMap((thing) =>
    stood(thing, thing.rest, isStaircase(thing.object.type) ? storey : undefined),
  )
}

function stood(thing: Standing, rest: number, climb: number | undefined): Piece[] {
  const { object, spot, surface, symbol } = thing
  const has = modelled(object.type)
  const stands = heightOf(object.type)
  const height = climb ?? stands.height
  const base = rest > 0 ? rest : stands.base
  const paints = paintOf(surface)

  const bounds = slab({
    h: height,
    w: object.width,
    d: object.depth,
    paint: {
      colour: surface.fill,
      ...(has ? { opacity: 0 } : stands.glass ? { opacity: 0.35 } : {}),
    },
  })

  const built = has
    ? piecesOf(object.type, {
        w: object.width,
        d: object.depth,
        h: height,
        body: paints.body,
        frame: paints.frame,
      })
    : []

  const laid =
    symbol && !has
      ? [
          {
            body: {
              kind: 'symbol' as const,
              file: symbol,
              width: object.width,
              depth: object.depth,
            },
            at: { x: 0, y: height + SYMBOL_LIFT, z: 0 },
            paint: paints.body,
          },
        ]
      : []

  return owned(
    { kind: 'object', id: object.id },
    put({ x: spot.at.x, y: base, z: -spot.at.y, turn: spot.turn }, [
      ...[bounds],
      ...built,
      ...laid,
    ]),
  )
}

function restOf(thing: Standing, all: Standing[]): number {
  if (layerOf(thing.object.type) !== 'over') return 0
  let top = 0
  for (const other of all) {
    if (other === thing || layerOf(other.object.type) !== 'floor') continue
    if (other.object.room !== thing.object.room) continue
    const under = footprintOf(other.spot, other.object)
    if (!containsPoint(under, thing.spot.at.x, thing.spot.at.y)) continue
    const stands = heightOf(other.object.type)
    top = Math.max(top, stands.base + stands.height)
  }
  return top
}
