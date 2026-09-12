import type { HouseDocument } from '@houseit/core/document'

import type { Point } from './outlines'

const PARALLEL = 1e-9

export function clearOutline(doc: HouseDocument, level: string, nodes: string[]): Point[] {
  const corners = nodes.map((id) => doc.nodes[id]).filter((node) => node !== undefined)
  if (corners.length !== nodes.length || corners.length < 3) return []

  const walls = Object.values(doc.walls).filter((wall) => wall.level === level)
  const turn = shoelace(corners) > 0 ? 1 : -1
  const edges = corners.map((a, index) => {
    const b = corners[(index + 1) % corners.length]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    const span = Math.hypot(dx, dy)
    if (span === 0) return undefined

    const way = { x: dx / span, y: dy / span }
    const inward = { x: -way.y * turn, y: way.x * turn }

    const from = nodes[index]!
    const to = nodes[(index + 1) % nodes.length]!
    const wall = walls.find(
      (candidate) =>
        (candidate.a === from && candidate.b === to) ||
        (candidate.a === to && candidate.b === from),
    )
    const back = (wall?.thickness ?? 0) / 2
    return {
      at: { x: a.x + inward.x * back, y: a.y + inward.y * back },
      end: { x: b.x + inward.x * back, y: b.y + inward.y * back },
      way,
    }
  })

  if (edges.some((edge) => edge === undefined)) return []

  return edges.flatMap((edge, index) => {
    const before = edges[(index + edges.length - 1) % edges.length]!
    // A free wall end turns back 180°. Both offset corners form its cap;
    // one corner would count only a triangular half of the return's footprint.
    if (before!.way.x * edge!.way.x + before!.way.y * edge!.way.y < -1 + PARALLEL)
      return [before!.end, edge!.at]
    if (before!.way.x * edge!.way.x + before!.way.y * edge!.way.y > 1 - PARALLEL) {
      const distance = Math.abs(
        (before!.end.x - edge!.at.x) * edge!.way.y - (before!.end.y - edge!.at.y) * edge!.way.x,
      )
      // A split on one straight wall adds no corner. Keeping its original
      // point can backtrack past the inset corner of a narrow shaft.
      return distance < PARALLEL ? [] : [before!.end, edge!.at]
    }
    return meeting(before!, edge!) ?? edge!.at
  })
}

export function clearAreaOf(doc: HouseDocument, level: string, nodes: string[]): number {
  const outline = clearOutline(doc, level, nodes)
  if (outline.length < 3) return 0
  const area = Math.abs(shoelace(outline))
  return Number.isFinite(area) ? area : 0
}

type Edge = { at: Point; way: Point }

function meeting(one: Edge, other: Edge): Point | undefined {
  const cross = one.way.x * other.way.y - one.way.y * other.way.x
  if (Math.abs(cross) < PARALLEL) return undefined
  const dx = other.at.x - one.at.x
  const dy = other.at.y - one.at.y
  const along = (dx * other.way.y - dy * other.way.x) / cross
  return { x: one.at.x + one.way.x * along, y: one.at.y + one.way.y * along }
}

function shoelace(points: Point[]): number {
  let total = 0
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!
    const b = points[(i + 1) % points.length]!
    total += a.x * b.y - b.x * a.y
  }
  return total / 2
}
