import type { HouseDocument } from '@houseit/core/document'
import { layerOf, objectType } from '@houseit/core/object-types'
import { boxOf, clashesAny, INSIDE_A_WALL, wallBox } from '@houseit/geometry/boxes'
import { fitsInside } from '@houseit/geometry/fits'
import type { Room } from '@houseit/geometry/rooms'
import { footprintOf, piecesOf, reachOf, standingAt, turnOf } from '@houseit/geometry/standing'
import type { Spot } from './place-object'

export type Shape = { type: string; width: number; depth: number; rotation?: number }

export function takenBy(shape: Shape): { width: number; depth: number } {
  const spread = objectType(shape.type)?.reach ?? 0
  const reach = reachOf(shape)
  return { width: reach.across + spread * 2, depth: reach.into + spread * 2 }
}

export type Standing = { overhang?: boolean }

export function canStand(
  doc: HouseDocument,
  level: string,
  room: Room,
  spot: Spot,
  shape: Shape,
  except?: string,
  how: Standing = {},
): boolean {
  return standingProblem(doc, level, room, spot, shape, except, how) === undefined
}

export function standingProblem(
  doc: HouseDocument,
  level: string,
  room: Room,
  spot: Spot,
  shape: Shape,
  except?: string,
  how: Standing = {},
): string | undefined {
  const { width, depth, rotation } = shape
  const at = standingAt(doc, level, room, { ...spot, width, depth, rotation })
  if (!at) return `${room.name ?? 'the room'} has no wall on that side`

  const spread = objectType(shape.type)?.reach ?? 0
  const reach = reachOf(shape)
  const taken = takenBy(shape)

  const needs = spot.against ? { width: taken.width, depth: reach.into + spread } : taken
  const forward = spot.against ? spread / 2 : 0
  const middle = {
    at: {
      x: at.at.x - Math.sin(at.turn) * forward,
      y: at.at.y + Math.cos(at.turn) * forward,
    },
    turn: at.turn - turnOf({ rotation }),
  }
  if (!how.overhang && !fitsInside(doc, room, footprintOf(middle, needs))) {
    return `it would reach outside ${room.name ?? 'the room'}`
  }

  const boxes = piecesOf(at, { type: shape.type, width, depth }).map(boxOf)
  const buried = Object.values(doc.walls)
    .filter((wall) => wall.level === level)
    .some((wall) => {
      const from = doc.nodes[wall.a]
      const to = doc.nodes[wall.b]
      return (
        from !== undefined &&
        to !== undefined &&
        clashesAny(boxes, [wallBox(from, to, wall.thickness)], INSIDE_A_WALL)
      )
    })
  if (buried) return 'it would stand in a wall'

  const layer = layerOf(shape.type)
  const inTheWay = Object.values(doc.objects)
    .filter(
      (other) =>
        other.id !== except &&
        other.room === room.id &&
        other.level === level &&
        layerOf(other.type) === layer,
    )
    .find((other) => {
      const stood = standingAt(doc, level, room, other)
      return stood !== undefined && clashesAny(boxes, piecesOf(stood, other).map(boxOf))
    })
  if (inTheWay) {
    return `it would stand in the ${objectType(inTheWay.type)?.label.toLowerCase() ?? inTheWay.type}`
  }
  return undefined
}
