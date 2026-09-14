import type { HouseDocument } from '@houseit/core/document'
import { floorMaterial } from '@houseit/core/floor-materials'
import { siteHeight } from '@houseit/core/site'
import { drum, type Piece, slab } from './pieces'

type Point = { x: number; y: number; z: number }
function beam(a: Point, b: Point, width: number, depth: number, colour: string): Piece {
  const run = Math.hypot(b.x - a.x, b.y - a.y)
  return {
    body: { kind: 'box', width: Math.hypot(run, b.z - a.z), height: depth, depth: width },
    at: { x: (a.x + b.x) / 2, y: (a.z + b.z) / 2, z: -(a.y + b.y) / 2 },
    turn: Math.atan2(b.y - a.y, b.x - a.x),
    roll: Math.atan2(b.z - a.z, run),
    paint: { colour },
  }
}

export function sitePieces(doc: HouseDocument): Piece[] {
  const site = doc.site
  if (!site) return []
  const pieces: Piece[] = site.surfaces.map((s) => {
    const material = s.material ? floorMaterial(s.material) : undefined
    return {
      name: `site-${s.id}`,
      role: 'site-surface',
      body: {
        kind: 'prism',
        outline: s.outline.map((p) => ({ x: p.x, z: -p.y })),
        holes: [],
        thickness: s.depth,
        slope: {
          x: s.slope.x,
          z: -s.slope.y,
          offset: -s.outline[0]!.x * s.slope.x - s.outline[0]!.y * s.slope.y,
          both: true,
        },
      },
      at: { x: 0, y: s.elevation - s.depth / 2, z: 0 },
      paint: {
        colour: s.colour,
        ...(material
          ? {
              texture: material.texture,
              repeat: { x: 1000 / material.unit.width, y: 1000 / material.unit.depth },
            }
          : {}),
      },
    }
  })
  for (const line of site.markings) {
    const surface = site.surfaces.find((s) => s.id === line.surface)!
    line.points.slice(1).forEach((b, i) => {
      const a = line.points[i]!
      pieces.push({
        ...beam(
          { ...a, z: siteHeight(surface, a.x, a.y) + 3 },
          { ...b, z: siteHeight(surface, b.x, b.y) + 3 },
          line.width,
          2,
          line.colour,
        ),
        name: `site-${line.id}-${i}`,
        role: 'site-marking',
        casts: false,
      })
    })
  }
  for (const rail of site.railings) {
    rail.points.slice(1).forEach((b, segment) => {
      const a = rail.points[segment]!
      const run = Math.hypot(b.x - a.x, b.y - a.y)
      const point = (t: number): Point => ({
        x: a.x + t * (b.x - a.x),
        y: a.y + t * (b.y - a.y),
        z: a.z + t * (b.z - a.z),
      })
      const posts = Math.max(1, Math.ceil(run / rail.spacing))
      for (let i = 0; i <= posts; i++) {
        if (segment > 0 && i === 0) continue
        const p = point(i / posts)
        pieces.push(
          rail.round
            ? drum({
                x: p.x,
                z: -p.y,
                base: p.z,
                r: rail.postSize / 2,
                h: rail.height,
                paint: { colour: rail.colour },
              })
            : slab({
                x: p.x,
                z: -p.y,
                base: p.z,
                w: rail.postSize,
                d: rail.postSize,
                h: rail.height,
                paint: { colour: rail.colour },
              }),
        )
      }
      for (const lift of rail.rails ?? [100, rail.height - rail.postSize / 2]) {
        const member = beam(
          { ...a, z: a.z + lift },
          { ...b, z: b.z + lift },
          rail.postSize,
          rail.postSize,
          rail.colour,
        )
        pieces.push(
          rail.round
            ? {
                ...member,
                body: {
                  kind: 'drum',
                  radius: rail.postSize / 2,
                  top: rail.postSize / 2,
                  height: Math.hypot(run, b.z - a.z),
                  open: false,
                  stretch: 1,
                },
                roll: (member.roll ?? 0) - Math.PI / 2,
              }
            : member,
        )
      }
      if (rail.infill === 'glass') {
        const glass = beam({ ...a, z: a.z + 500 }, { ...b, z: b.z + 500 }, 12, 1000, '#bfced3')
        pieces.push({ ...glass, paint: { colour: '#bfced3', opacity: 0.24 } })
      }
      if (rail.infill !== 'bars') return
      const bars = Math.max(1, Math.ceil(run / rail.barSpacing))
      for (let i = 1; i < bars; i++) {
        const p = point(i / bars)
        pieces.push(
          slab({
            x: p.x,
            z: -p.y,
            base: p.z + 100,
            w: rail.barSize,
            d: rail.barSize,
            h: Math.max(1, rail.height - 100),
            paint: { colour: rail.colour },
          }),
        )
      }
    })
  }
  return pieces.map((p, i) => ({
    ...p,
    role: p.role ?? 'site-railing',
    name: p.name ?? `site-rail-${i}`,
  }))
}
