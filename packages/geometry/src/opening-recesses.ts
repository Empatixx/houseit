import type { HouseDocument } from '@houseit/core/document'
import { frameOffset } from '@houseit/core/opening-parts'
import { exteriorSides } from './exterior'
import type { Point } from './outlines'

export type OpeningRecess = {
  opening: string
  wall: string
  outline: Point[]
  extension: Point[]
  area: number
}

export function openingRecesses(doc: HouseDocument, level: string): OpeningRecess[] {
  const candidates = Object.values(doc.openings).filter(
    (o) => o.frame?.inset !== undefined && o.sillHeight === 0 && doc.walls[o.wall]?.level === level,
  )
  if (!candidates.length) return []
  const outside = exteriorSides(doc, level)
  return candidates.flatMap((o) => {
    const side = outside.get(o.wall)
    if (side === undefined) return []
    const wall = doc.walls[o.wall]!,
      a = doc.nodes[wall.a]!,
      b = doc.nodes[wall.b]!,
      span = Math.hypot(b.x - a.x, b.y - a.y),
      ux = (b.x - a.x) / span,
      uy = (b.y - a.y) / span
    const frame = o.frame!,
      outer = frameOffset(o, wall, side) * side + frame.depth / 2,
      inner = outer - frame.depth,
      depth = Math.max(0, inner + wall.thickness / 2)
    const rectangle = (from: number, to: number): Point[] =>
      [
        [-o.width / 2, from],
        [o.width / 2, from],
        [o.width / 2, to],
        [-o.width / 2, to],
      ].map(([along, off]) => ({
        x: a.x + (o.t * span + along!) * ux - off! * side * uy,
        y: a.y + (o.t * span + along!) * uy + off! * side * ux,
      }))
    return [
      {
        opening: o.id,
        wall: wall.id,
        outline: rectangle(-wall.thickness / 2, inner),
        extension: outer > 0 ? rectangle(0, outer) : [],
        area: depth * o.width,
      },
    ]
  })
}
