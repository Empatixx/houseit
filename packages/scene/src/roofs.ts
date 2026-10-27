import type { HouseDocument } from '@houseit/core/document'
import { nestedEntityKey } from '@houseit/core/entity-key'
import { floorMaterial } from '@houseit/core/floor-materials'
import type { Roof } from '@houseit/core/roof'
import { grown, outlineOf, pitchedFacets, type Rect } from '@houseit/core/roof-shapes'
import { connectionHoles } from '@houseit/geometry/connections'
import { holesIn } from '@houseit/geometry/wells'
import { drum, type Finish, type Piece, slab } from './pieces'

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
    const base = storey.height + (roof.baseOffset ?? 0)
    const paintFor = (id?: string) => {
      const material = floorMaterial(
        id ??
          roof.material ??
          (roof.finish === 'planted' ? 'sedum' : roof.finish === 'gravel' ? 'roof-gravel' : ''),
      )
      return {
        colour: roof.colour ?? (roof.finish === 'membrane' && !material ? '#62686b' : '#ffffff'),
        texture: material?.texture,
        repeat: material
          ? { x: 1000 / material.unit.width, y: 1000 / material.unit.depth }
          : undefined,
      }
    }
    const holes = holesIn(
      roof.outline,
      connectionHoles(doc, level, true).map((w) => w.outline),
    ).map((h) => h.outline.map((p) => ({ x: p.x, z: -p.y })))
    if (roof.pitched && roof.facets) return pitchedPieces(roof, base, level, index)
    const pieces: Piece[] = roof.facets
      ? roof.facets.map((facet) => {
          const [a, b, c] = facet.points
          const determinant = (b!.x - a!.x) * (c!.y - a!.y) - (c!.x - a!.x) * (b!.y - a!.y)
          const sx =
            ((b!.height - a!.height) * (c!.y - a!.y) - (c!.height - a!.height) * (b!.y - a!.y)) /
            determinant
          const sy =
            ((b!.x - a!.x) * (c!.height - a!.height) - (c!.x - a!.x) * (b!.height - a!.height)) /
            determinant
          return {
            body: {
              kind: 'prism',
              outline: facet.points.map((p) => ({ x: p.x, z: -p.y })),
              holes: [],
              thickness: roof.depth,
              slope: { x: sx, z: -sy, offset: a!.height - roof.depth - sx * a!.x - sy * a!.y },
            },
            at: { x: 0, y: base + roof.depth / 2, z: 0 },
            paint: paintFor(facet.material),
          }
        })
      : [
          {
            body: {
              kind: 'prism',
              outline: roof.outline.map((p) => ({ x: p.x, z: -p.y })),
              holes,
              thickness: roof.depth,
              slope: { ...slope, offset: -bottom },
            },
            at: { x: 0, y: base + roof.depth / 2, z: 0 },
            paint: paintFor(),
          },
        ]
    const edges =
      roof.parapet.edges ??
      roof.outline.map((a, i) => ({
        from: a,
        to: roof.outline[(i + 1) % roof.outline.length]!,
        colour: roof.parapet.colour,
      }))
    for (const edge of edges) {
      const a = edge.from
      const b = edge.to
      if (roof.parapet.height === 0) continue
      const length = Math.hypot(b.x - a.x, b.y - a.y)
      const joined = (p: typeof a) =>
        edges.some(
          (e) =>
            e !== edge &&
            ((e.from.x === p.x && e.from.y === p.y) || (e.to.x === p.x && e.to.y === p.y)) &&
            (e.to.x - e.from.x) * (b.y - a.y) === (e.to.y - e.from.y) * (b.x - a.x),
        )
      const growA = joined(a) ? 0 : roof.parapet.thickness / 2,
        growB = joined(b) ? 0 : roof.parapet.thickness / 2
      pieces.push(
        slab({
          x: (a.x + b.x) / 2 + (((b.x - a.x) / length) * (growB - growA)) / 2,
          z: -(a.y + b.y) / 2 - (((b.y - a.y) / length) * (growB - growA)) / 2,
          base,
          w: length + growA + growB,
          h: roof.parapet.height,
          d: roof.parapet.thickness,
          turn: Math.atan2(b.y - a.y, b.x - a.x),
          paint: { colour: edge.colour },
        }),
      )
      pieces.push(
        slab({
          x: (a.x + b.x) / 2,
          z: -(a.y + b.y) / 2,
          base: base + roof.parapet.height,
          w: Math.hypot(b.x - a.x, b.y - a.y) + roof.parapet.thickness + 20,
          h: roof.parapet.coping ?? 20,
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
          base:
            base +
            (roof.facets
              ? facetHeight(roof.facets, drain)
              : -bottom + drain.x * slope.x - drain.y * slope.z + roof.depth),
          r: drain.diameter / 2,
          h: 10,
          paint: { colour: '#272e32' },
        }),
      )
    }
    return pieces.map((piece, i) => ({
      ...piece,
      role: 'roof-solid',
      name: `roof-${index}-${i}`,
      ...(roof.id ? { entity: nestedEntityKey('roofs', `levels:${level}`, roof.id) } : {}),
    }))
  })
}

function facetHeight(
  facets: { points: { x: number; y: number; height: number }[] }[],
  p: { x: number; y: number },
): number {
  for (const { points } of facets) {
    const [a, b, c] = points
    const d = (b!.y - c!.y) * (a!.x - c!.x) + (c!.x - b!.x) * (a!.y - c!.y)
    const u = ((b!.y - c!.y) * (p.x - c!.x) + (c!.x - b!.x) * (p.y - c!.y)) / d
    const v = ((c!.y - a!.y) * (p.x - c!.x) + (a!.x - c!.x) * (p.y - c!.y)) / d
    if (u >= -1e-7 && v >= -1e-7 && u + v <= 1 + 1e-7)
      return u * a!.height + v * b!.height + (1 - u - v) * c!.height
  }
  throw Error('Roof drain is outside its surface facets')
}

type Point3 = { x: number; y: number; height: number }

function planeOf([a, b, c]: Point3[]) {
  const determinant = (b!.x - a!.x) * (c!.y - a!.y) - (c!.x - a!.x) * (b!.y - a!.y)
  const sx =
    ((b!.height - a!.height) * (c!.y - a!.y) - (c!.height - a!.height) * (b!.y - a!.y)) /
    determinant
  const sy =
    ((b!.x - a!.x) * (c!.height - a!.height) - (c!.x - a!.x) * (b!.height - a!.height)) /
    determinant
  return { sx, sy, offset: a!.height - sx * a!.x - sy * a!.y }
}

function pitchedPieces(roof: Roof, base: number, level: string, index: number): Piece[] {
  const pitched = roof.pitched!
  const xs = roof.outline.map((p) => p.x)
  const ys = roof.outline.map((p) => p.y)
  const rect: Rect = {
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    y0: Math.min(...ys),
    y1: Math.max(...ys),
  }
  const slope = Math.tan((pitched.pitch * Math.PI) / 180)
  const hang = pitched.overhang
  const eaveHang =
    pitched.shape === 'shed'
      ? hang[pitched.towards ?? 'south']
      : pitched.axis === 'x'
        ? Math.max(hang.north, hang.south)
        : Math.max(hang.east, hang.west)
  const wide = grown(rect, hang)
  const plates = pitchedFacets(wide, { ...pitched, eave: pitched.eave - eaveHang * slope })
  const material = floorMaterial(roof.material ?? 'roof-tiles')
  const covering = (sx: number, sy: number): Finish => ({
    colour: roof.colour ?? '#ffffff',
    texture:
      material && Math.abs(sx) > Math.abs(sy)
        ? material.texture.replace(/\.svg$/, '-90.svg')
        : material?.texture,
    repeat: material ? { x: 1000 / material.unit.width, y: 1000 / material.unit.depth } : undefined,
  })
  const walls: Finish = { colour: pitched.walls }
  const fascia: Finish = { colour: pitched.fascia, roughness: 0.6 }
  const pieces: Piece[] = (roof.facets ?? []).map((facet) => {
    const { sx, sy, offset } = planeOf(facet.points)
    return {
      body: {
        kind: 'prism',
        outline: facet.points.map((p) => ({ x: p.x, z: -p.y })),
        holes: [],
        thickness: roof.depth,
        slope: { x: sx, z: -sy, offset: offset - roof.depth },
      },
      at: { x: 0, y: base + roof.depth / 2, z: 0 },
      paint: walls,
      sidePaint: walls,
    }
  })
  for (const plate of plates) {
    const { sx, sy, offset } = planeOf(plate.points)
    pieces.push({
      body: {
        kind: 'prism',
        outline: plate.points.map((p) => ({ x: p.x, z: -p.y })),
        holes: [],
        thickness: pitched.plate,
        slope: { x: sx, z: -sy, offset, both: true },
      },
      at: { x: 0, y: base + pitched.plate / 2, z: 0 },
      paint: covering(sx, sy),
      sidePaint: fascia,
    })
  }
  const low = base + pitched.eave - eaveHang * slope - 60
  const gutter = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    slab({
      x: (a.x + b.x) / 2,
      z: -(a.y + b.y) / 2,
      base: low,
      w: Math.hypot(b.x - a.x, b.y - a.y),
      d: 120,
      h: 110,
      turn: Math.atan2(b.y - a.y, b.x - a.x),
      paint: { colour: '#4a4e52', roughness: 0.5 },
    })
  const [sw, se, ne, nw] = outlineOf(wide)
  const eaves: [typeof sw, typeof sw][] =
    pitched.shape === 'shed'
      ? [
          {
            south: [sw, se],
            north: [nw, ne],
            west: [sw, nw],
            east: [se, ne],
          }[pitched.towards ?? 'south'] as [typeof sw, typeof sw],
        ]
      : pitched.axis === 'x'
        ? [
            [sw, se],
            [nw, ne],
          ]
        : [
            [sw, nw],
            [se, ne],
          ]
  if (pitched.shape === 'hip') {
    const ends: [typeof sw, typeof sw][] =
      pitched.axis === 'x'
        ? [
            [sw, nw],
            [se, ne],
          ]
        : [
            [sw, se],
            [nw, ne],
          ]
    ends.forEach((end, i) => {
      if ((pitched.ends?.[i] ?? 'hip') === 'hip') eaves.push(end)
    })
  }
  const outside = (edge: [typeof sw, typeof sw]) => {
    const side =
      edge[0]!.y === edge[1]!.y
        ? edge[0]!.y === wide.y0
          ? 'south'
          : 'north'
        : edge[0]!.x === wide.x0
          ? 'west'
          : 'east'
    return hang[side] > 0
  }
  for (const edge of eaves) if (outside(edge)) pieces.push(gutter(edge[0]!, edge[1]!))
  return pieces.map((piece, i) => ({
    ...piece,
    role: 'roof-solid',
    name: `roof-${index}-${i}`,
    ...(roof.id ? { entity: nestedEntityKey('roofs', `levels:${level}`, roof.id) } : {}),
  }))
}
