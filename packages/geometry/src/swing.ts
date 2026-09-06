import type { HouseDocument, Opening } from '@houseit/core/document'
import { type Box, boxOf } from './boxes'
import type { Point } from './outlines'

export function sweptBy(
  a: Point,
  b: Point,
  span: number,
  at: number,
  width: number,
  swing: -1 | 1,
): Box {
  const unit = { x: (b.x - a.x) / (span || 1), y: (b.y - a.y) / (span || 1) }
  const into = { x: -unit.y * swing, y: unit.x * swing }
  const hinge = { x: a.x + unit.x * (at - width / 2), y: a.y + unit.y * (at - width / 2) }

  return boxOf(
    [0, 1].flatMap((along) =>
      [0, 1].map((out) => ({
        x: hinge.x + unit.x * width * along + into.x * width * out,
        y: hinge.y + unit.y * width * along + into.y * width * out,
      })),
    ),
  )
}

export function swingOf(doc: HouseDocument, opening: Opening): Box | undefined {
  if (opening.kind !== 'door' || opening.variant !== 'hinged') return undefined
  const wall = doc.walls[opening.wall]
  const a = wall && doc.nodes[wall.a]
  const b = wall && doc.nodes[wall.b]
  if (!a || !b) return undefined

  const span = Math.hypot(b.x - a.x, b.y - a.y)
  return sweptBy(a, b, span, opening.t * span, opening.width, opening.swing)
}
