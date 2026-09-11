import type { HouseDocument } from '@houseit/core/document'
import { rampDirection, rampOutline } from '@houseit/geometry/connections'
import { type Piece, slab } from './pieces'

export function connectionPieces(doc: HouseDocument, level: string): Piece[] {
  const storey = doc.levels[level]
  if (!storey) return []
  const ramps: Piece[] = (storey.ramps ?? []).flatMap((r) => {
    const to = doc.levels[r.to]
    if (!to) return []
    const rise = to.elevation - storey.elevation
    const direction = rampDirection(r)
    const outline = rampOutline(r)
    const rate = rise / r.length
    const slope = {
      x: direction.x * rate,
      z: -direction.y * rate,
      offset: -(r.x * direction.x + r.y * direction.y) * rate,
    }
    // Both faces slope: a suspended concrete ramp, with a constant vertical thickness.
    return [
      {
        body: {
          kind: 'prism' as const,
          outline: outline.map((p) => ({ x: p.x, z: -p.y })),
          holes: [],
          thickness: r.thickness,
          slope: { ...slope, both: true },
        },
        at: { x: 0, y: -r.thickness / 2, z: 0 },
        paint: { colour: r.colour },
        name: `ramp-${r.id}`,
      },
    ]
  })
  const guides: Piece[] = (storey.shafts ?? []).flatMap((s) => {
    const top = doc.levels[s.to]
    if (!top) return []
    const height = top.elevation + top.height - storey.elevation
    return [-1, 1].map((side) => ({
      ...slab({
        x: s.x + side * (s.width / 2 - 60),
        z: -s.y,
        w: 35,
        d: 60,
        h: height,
        paint: { colour: '#6e7478' },
      }),
      name: `shaft-${s.id}-${side}`,
    }))
  })
  return [...ramps, ...guides]
}
