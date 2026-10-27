import type { HouseDocument } from '@houseit/core/document'
import { layerOf } from '@houseit/core/object-types'
import { openingsIn } from '@houseit/core/opening-parts'
import { type Box, boxOf, clashes, clashesAny } from '@houseit/geometry/boxes'
import type { Point } from '@houseit/geometry/outlines'
import type { Room } from '@houseit/geometry/rooms'
import { piecesOf, standingAt } from '@houseit/geometry/standing'
import { swingOf } from '@houseit/geometry/swing'
import { label, type Problem, type Rule, realOpening } from './rule'

const HAND = 100

export const doors: Rule = ({ doc, level, rooms }) => {
  const problems: Problem[] = []
  const byId = new Map(rooms.filter((room) => room.id).map((room) => [room.id!, room] as const))
  const standing = Object.values(doc.objects)
    .filter((object) => object.level === level && layerOf(object.type) === 'floor')
    .flatMap((object) => {
      const room = byId.get(object.room)
      const spot = room && standingAt(doc, level, room, object)
      return spot ? [{ object, room, boxes: piecesOf(spot, object).map(boxOf) }] : []
    })
  const swings = openingsIn(doc)
    .filter((opening) => opening.kind === 'door' && doc.walls[opening.wall]?.level === level)
    .flatMap((opening) => {
      const box = swingOf(doc, opening)
      return box ? [{ opening, box }] : []
    })

  for (const { opening, box } of swings) {
    const into = roomOfSwing(doc, rooms, box)
    const where = into?.name ? ` in ${into.name}` : ''
    const reach = {
      x0: box.x0 - HAND,
      y0: box.y0 - HAND,
      x1: box.x1 + HAND,
      y1: box.y1 + HAND,
    }
    const blocked = standing.find(
      (thing) => (!into || thing.room.id === into.id) && clashesAny([reach], thing.boxes, 0),
    )
    if (blocked) {
      problems.push({
        code: 'door.blocked',
        severity: 'error',
        room: into?.name,
        ids: [realOpening(opening.id), blocked.object.id],
        message: `a door${where} cannot open fully: the ${label(blocked.object)} stands in its swing or within a hand of it`,
      })
    }
    const other = swings.find((it) => it.opening.id !== opening.id && clashes(box, it.box))
    if (other && opening.id < other.opening.id) {
      problems.push({
        code: 'door.clash',
        severity: 'warning',
        room: into?.name,
        ids: [realOpening(opening.id), realOpening(other.opening.id)],
        message: `two doors${where} swing into each other`,
      })
    }
  }
  return problems
}

function roomOfSwing(doc: HouseDocument, rooms: Room[], box: Box): Room | undefined {
  const middle = { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 }
  return rooms.find((room) => {
    const polygon = room.nodes.map((id) => doc.nodes[id]).filter((node) => node !== undefined)
    return inside(polygon, middle)
  })
}

function inside(polygon: Point[], point: Point): boolean {
  let hit = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]!
    const b = polygon[j]!
    const crosses = a.y > point.y !== b.y > point.y
    if (crosses && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) hit = !hit
  }
  return hit
}
