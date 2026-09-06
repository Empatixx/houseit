import { STANDARD } from '@houseit/core/dispositions'
import type { Opening, Wall } from '@houseit/core/document'
import { layerOf } from '@houseit/core/object-types'
import type { Box } from '@houseit/geometry/boxes'
import { boxOf } from '@houseit/geometry/boxes'
import type { Point } from '@houseit/geometry/outlines'
import { freeSpans, type Span } from '@houseit/geometry/spans'
import { piecesOf, standingAt } from '@houseit/geometry/standing'
import { label, type Problem, type Rule } from './rule'

const SQUEEZE = 600

export const approach: Rule = ({ doc, level, rooms }) => {
  const problems: Problem[] = []
  const byId = new Map(rooms.filter((room) => room.id).map((room) => [room.id!, room] as const))
  const standing = Object.values(doc.objects)
    .filter((object) => object.level === level && layerOf(object.type) === 'floor')
    .flatMap((object) => {
      const room = byId.get(object.room)
      const spot = room && standingAt(doc, level, room, object)
      return spot ? [{ object, room, boxes: piecesOf(spot, object).map(boxOf) }] : []
    })

  for (const opening of Object.values(doc.openings)) {
    if (opening.kind !== 'door' || opening.variant === 'garage') continue
    const wall = doc.walls[opening.wall]
    if (!wall || wall.level !== level) continue
    const doorway = doorwayOf(doc.nodes[wall.a], doc.nodes[wall.b], wall, opening)
    if (!doorway) continue

    const swings = opening.variant === 'hinged'
    const sides: (-1 | 1)[] = swings ? [-opening.swing as -1 | 1] : [1, -1]

    for (const side of sides) {
      const taken: Span[] = []
      let culprit: (typeof standing)[number] | undefined
      for (const thing of standing) {
        for (const box of thing.boxes) {
          const span = acrossDoorway(box, doorway, side)
          if (!span) continue
          taken.push(span)
          culprit ??= thing
        }
      }
      if (!culprit) continue

      const widest = freeSpans(doorway.width, taken).reduce(
        (most, free) => Math.max(most, free.to - free.from),
        0,
      )
      if (widest >= Math.min(doorway.width, SQUEEZE)) continue

      const shut = widest < 1
      problems.push({
        code: 'door.no-approach',
        severity: shut ? 'error' : 'warning',
        room: culprit.room.name,
        message: shut
          ? `a door into ${culprit.room.name ?? 'a room'} cannot be got at at all: the ${label(culprit.object)} stands across the whole of it`
          : `a door into ${culprit.room.name ?? 'a room'} is a squeeze: the ${label(culprit.object)} leaves ${Math.round(widest)} mm of it clear, and ${SQUEEZE} mm is a shoulder`,
      })
    }
  }
  return problems
}

type Doorway = {
  centre: Point
  along: Point
  across: Point
  width: number
  face: number
}

function doorwayOf(
  a: Point | undefined,
  b: Point | undefined,
  wall: Wall,
  opening: Opening,
): Doorway | undefined {
  if (!a || !b) return undefined
  const span = Math.hypot(b.x - a.x, b.y - a.y)
  if (span === 0) return undefined
  const along = { x: (b.x - a.x) / span, y: (b.y - a.y) / span }
  return {
    centre: { x: a.x + along.x * opening.t * span, y: a.y + along.y * opening.t * span },
    along,
    across: { x: -along.y, y: along.x },
    width: opening.width,
    face: wall.thickness / 2,
  }
}

function acrossDoorway(box: Box, doorway: Doorway, side: -1 | 1): Span | undefined {
  const corners = [
    { x: box.x0, y: box.y0 },
    { x: box.x1, y: box.y0 },
    { x: box.x0, y: box.y1 },
    { x: box.x1, y: box.y1 },
  ].map((corner) => ({ x: corner.x - doorway.centre.x, y: corner.y - doorway.centre.y }))

  const out = corners.map(
    (corner) => (corner.x * doorway.across.x + corner.y * doorway.across.y) * side,
  )
  if (Math.max(...out) <= doorway.face || Math.min(...out) >= doorway.face + STANDARD.approach) {
    return undefined
  }

  const half = doorway.width / 2
  const on = corners.map((corner) => corner.x * doorway.along.x + corner.y * doorway.along.y)
  const from = Math.max(Math.min(...on), -half)
  const to = Math.min(Math.max(...on), half)
  return to <= from ? undefined : { from: from + half, to: to + half }
}
