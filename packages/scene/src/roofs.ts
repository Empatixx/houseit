import type { HouseDocument } from '@houseit/core/document'
import { connectionHoles } from '@houseit/geometry/connections'
import { holesIn } from '@houseit/geometry/wells'
import { drum, type Piece, slab } from './pieces'

export function roofPieces(doc: HouseDocument, level: string): Piece[] {
  const storey = doc.levels[level]
  if (!storey) return []
  return (storey.roofs ?? []).flatMap((roof, index) => {
    const rate = roof.fall.percent / 100
    const slope = {
      x: roof.fall.towards === 'east' ? -rate : roof.fall.towards === 'west' ? rate : 0,
      z: roof.fall.towards === 'north' ? rate : roof.fall.towards === 'south' ? -rate : 0,
    }
    const bottom = Math.min(...roof.outline.map((p) => p.x * slope.x - p.y * slope.z))
    const base = storey.height
    const paint = {
      colour:
        roof.finish === 'planted' ? '#728351' : roof.finish === 'gravel' ? '#b7b3a7' : '#62686b',
    }
    const pieces: Piece[] = [
      {
        body: {
          kind: 'prism',
          outline: roof.outline.map((p) => ({ x: p.x, z: -p.y })),
          holes: holesIn(
            roof.outline,
            connectionHoles(doc, level, true).map((w) => w.outline),
          ).map((h) => h.outline.map((p) => ({ x: p.x, z: -p.y }))),
          thickness: roof.depth,
          slope: { ...slope, offset: -bottom },
        },
        at: { x: 0, y: base + roof.depth / 2, z: 0 },
        paint,
      },
    ]
    for (let i = 0; i < roof.outline.length; i += 1) {
      const a = roof.outline[i]!
      const b = roof.outline[(i + 1) % roof.outline.length]!
      if (roof.parapet.height === 0) continue
      pieces.push(
        slab({
          x: (a.x + b.x) / 2,
          z: -(a.y + b.y) / 2,
          base: storey.height,
          w: Math.hypot(b.x - a.x, b.y - a.y) + roof.parapet.thickness,
          h: roof.parapet.height,
          d: roof.parapet.thickness,
          turn: Math.atan2(b.y - a.y, b.x - a.x),
          paint: { colour: roof.parapet.colour },
        }),
      )
      pieces.push(
        slab({
          x: (a.x + b.x) / 2,
          z: -(a.y + b.y) / 2,
          base: storey.height + roof.parapet.height,
          w: Math.hypot(b.x - a.x, b.y - a.y) + roof.parapet.thickness + 20,
          h: 20,
          d: roof.parapet.thickness + 40,
          turn: Math.atan2(b.y - a.y, b.x - a.x),
          paint: { colour: '#42494d' },
        }),
      )
    }
    for (const drain of roof.drains) {
      pieces.push(
        drum({
          x: drain.x,
          z: -drain.y,
          base: base - bottom + drain.x * slope.x - drain.y * slope.z + roof.depth,
          r: drain.diameter / 2,
          h: 10,
          paint: { colour: '#272e32' },
        }),
      )
    }
    return pieces.map((piece, i) => ({ ...piece, name: `roof-${index}-${i}` }))
  })
}
