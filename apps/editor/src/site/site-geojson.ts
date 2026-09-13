import type { Site } from '@houseit/core/document'
import { toLngLat } from './projection'

export type SiteGeoJson = {
  type: 'Feature'
  properties: { id: string; number: string }
  geometry: { type: 'MultiPolygon'; coordinates: number[][][][] }
}

export function siteGeoJson(site: Site): SiteGeoJson {
  const coordinate = ({ x, y }: { x: number; y: number }): number[] => {
    const point = toLngLat({
      x: (site.source.originXmm + x) / 1000,
      y: (site.source.originYmm + y) / 1000,
    })
    return [point.longitude, point.latitude]
  }
  const closed = (ring: { x: number; y: number }[]): number[][] => {
    const coordinates = ring.map(coordinate)
    return [...coordinates, [...coordinates[0]!]]
  }

  return {
    type: 'Feature',
    properties: { id: site.parcel.id, number: site.parcel.number },
    geometry: {
      type: 'MultiPolygon',
      coordinates: site.parcel.polygons.map((polygon) => [
        closed(polygon.outer),
        ...polygon.holes.map(closed),
      ]),
    },
  }
}
