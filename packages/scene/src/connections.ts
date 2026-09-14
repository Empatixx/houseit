import type { HouseDocument } from '@houseit/core/document'
import { soffitOf } from '@houseit/core/levels'
import { treadsOf } from '@houseit/core/stairs'
import {
  rampDirection,
  rampHeights,
  rampOutline,
  shaftsOn,
  shaftWallParts,
} from '@houseit/geometry/connections'
import { stairRise } from '@houseit/geometry/stair-runs'
import { type Piece, prism, slab } from './pieces'

export function connectionPieces(doc: HouseDocument, level: string): Piece[] {
  const storey = doc.levels[level]
  if (!storey) return []
  const ramps: Piece[] = (storey.ramps ?? []).flatMap((r) => {
    const heights = rampHeights(doc, level, r)
    if (!heights) return []
    const direction = rampDirection(r)
    const outline = rampOutline(r)
    const rate = heights.rise / r.length
    const slope = {
      x: direction.x * rate,
      z: -direction.y * rate,
      offset: -(r.x * direction.x + r.y * direction.y) * rate,
    }
    return [
      {
        body: {
          kind: 'prism' as const,
          outline: outline.map((p) => ({ x: p.x, z: -p.y })),
          holes: [],
          thickness: r.thickness,
          slope: { ...slope, both: true },
        },
        at: { x: 0, y: r.baseOffset - r.thickness / 2, z: 0 },
        paint: { colour: r.colour },
        name: `ramp-${r.id}`,
        role: 'ramp-solid',
      },
    ]
  })
  const guides: Piece[] = (storey.shafts ?? []).flatMap((s) => {
    if (s.kind !== 'lift') return []
    const top = doc.levels[s.to]
    if (!top) return []
    const height = top.elevation + soffitOf(top) - storey.elevation
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
      role: 'shaft-solid' as const,
    }))
  })
  const enclosure = shaftsOn(doc, level).flatMap((s) =>
    shaftWallParts(s).flatMap((p, index) => {
      const e = s.enclosure!
      const block = (base: number, height: number, colour: string): Piece => ({
        ...slab({ x: p.x, z: -p.y, w: p.width, d: p.depth, h: height, base, paint: { colour } }),
        name: `shaft-${s.id}-enclosure-${level}-${index}-${base}`,
        role: 'shaft-solid',
      })
      return p.door
        ? [
            block(0, e.doorHeight!, '#747a7e'),
            block(e.doorHeight!, soffitOf(storey) - e.doorHeight!, e.colour),
          ]
        : [block(0, soffitOf(storey), e.colour)]
    }),
  )
  const stairs = (storey.stairs ?? []).flatMap((s) => {
    const riser = stairRise(doc, level, s)
    return treadsOf(s).map((t) => ({
      ...prism({
        base: s.baseOffset + t.step * riser - s.thickness,
        thickness: s.thickness,
        outline: t.outline.map((p) => ({ x: p.x, z: -p.y })),
        paint: { colour: s.colour },
      }),
      name: `stair-${s.id}-${t.step}`,
      role: 'stair-solid' as const,
    }))
  })
  return [...ramps, ...guides, ...enclosure, ...stairs]
}
