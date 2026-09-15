import type { PointMm, Site } from '@houseit/core/parcel-site'
import { buildableAreaOf, edgeId, sitePointInHouse } from '@houseit/geometry/site'

export type SiteDrawing = {
  parcels: Array<{ outer: PointMm[]; holes: PointMm[][] }>
  buildable: PointMm[][]
  edges: Array<{ id: string; number: number; from: PointMm; to: PointMm; setbackMm: number }>
}

export function drawingOfSite(site: Site): SiteDrawing {
  const intoHouse = (point: PointMm) => sitePointInHouse(point, site.housePlacement)
  const parcels = site.parcel.polygons.map((polygon) => ({
    outer: polygon.outer.map(intoHouse),
    holes: polygon.holes.map((ring) => ring.map(intoHouse)),
  }))
  const edges: SiteDrawing['edges'] = []

  site.parcel.polygons.forEach((polygon, polygonIndex) => {
    const rings = [polygon.outer, ...polygon.holes]
    rings.forEach((ring, ringIndex) => {
      ring.forEach((from, edgeIndex) => {
        const id = edgeId(polygonIndex, ringIndex, edgeIndex)
        edges.push({
          id,
          number: edges.length + 1,
          from: intoHouse(from),
          to: intoHouse(ring[(edgeIndex + 1) % ring.length]!),
          setbackMm: site.setbacks.byEdge[id] ?? site.setbacks.defaultMm,
        })
      })
    })
  })

  return {
    parcels,
    buildable: buildableAreaOf(site).map((ring) => ring.map(intoHouse)),
    edges,
  }
}
