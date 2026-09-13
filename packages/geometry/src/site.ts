import type { HouseDocument, PointMm, Site } from '@houseit/core/document'
import { findFaces } from '@houseit/core/faces'
import {
  areaPaths,
  difference,
  EndType,
  FillRule,
  inflatePaths,
  intersect,
  JoinType,
  type Paths64,
  PointInPolygonResult,
  pointInPolygon,
  union,
} from 'clipper2-ts'

export type SiteArea = PointMm[][]

type Placement = Site['housePlacement']

export function placedPoint(point: PointMm, placement: Placement): PointMm {
  const angle = (placement.rotationMilliDegrees * Math.PI) / 180_000
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  return {
    x: Math.round(point.x * cosine - point.y * sine + placement.xMm),
    y: Math.round(point.x * sine + point.y * cosine + placement.yMm),
  }
}

export function sitePointInHouse(point: PointMm, placement: Placement): PointMm {
  const angle = (placement.rotationMilliDegrees * Math.PI) / 180_000
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  const x = point.x - placement.xMm
  const y = point.y - placement.yMm
  const whole = (value: number) => {
    const rounded = Math.round(value)
    return Object.is(rounded, -0) ? 0 : rounded
  }
  return {
    x: whole(x * cosine + y * sine),
    y: whole(-x * sine + y * cosine),
  }
}

export function parcelAreaOf(site: Site): SiteArea {
  return site.parcel.polygons.flatMap((polygon) => [polygon.outer, ...polygon.holes])
}

export function edgeId(polygon: number, ring: number, edge: number): string {
  return `p${polygon}:r${ring}:e${edge}`
}

export function buildableAreaOf(site: Site): SiteArea {
  const parcel = parcelAreaOf(site)
  const forbidden: Paths64 = []

  site.parcel.polygons.forEach((polygon, polygonIndex) => {
    const rings = [polygon.outer, ...polygon.holes]
    rings.forEach((ring, ringIndex) => {
      ring.forEach((point, edgeIndex) => {
        const distance =
          site.setbacks.byEdge[edgeId(polygonIndex, ringIndex, edgeIndex)] ??
          site.setbacks.defaultMm
        if (distance === 0) return
        const next = ring[(edgeIndex + 1) % ring.length]!
        forbidden.push(...inflatePaths([[point, next]], distance, JoinType.Square, EndType.Square))
      })
    })
  })

  if (forbidden.length === 0) return parcel.map((path) => path.map((point) => ({ ...point })))
  const clipped = intersect(union(forbidden, FillRule.NonZero), parcel, FillRule.EvenOdd)
  return difference(parcel, clipped, FillRule.EvenOdd)
}

export function pointInArea(point: PointMm, paths: SiteArea): boolean {
  let inside = false
  for (const path of paths) {
    const result = pointInPolygon(point, path)
    if (result === PointInPolygonResult.IsOn) return true
    if (result === PointInPolygonResult.IsInside) inside = !inside
  }
  return inside
}

export function buildingEnvelopeOf(doc: HouseDocument): SiteArea {
  const paths: Paths64 = []

  for (const level of Object.keys(doc.levels)) {
    for (const face of findFaces(doc, level)) {
      paths.push(face.nodes.map((node) => doc.nodes[node]!).filter(Boolean))
    }
  }

  for (const wall of Object.values(doc.walls)) {
    const a = doc.nodes[wall.a]
    const b = doc.nodes[wall.b]
    if (!a || !b || (a.x === b.x && a.y === b.y)) continue
    paths.push(...inflatePaths([[a, b]], wall.thickness / 2, JoinType.Square, EndType.Square))
  }

  return paths.length === 0 ? [] : union(paths, FillRule.NonZero)
}

export function placedEnvelopeOf(doc: HouseDocument): SiteArea {
  const envelope = buildingEnvelopeOf(doc)
  if (!doc.site) return envelope
  return envelope.map((path) => path.map((point) => placedPoint(point, doc.site!.housePlacement)))
}

export function houseFitsSite(doc: HouseDocument): boolean {
  if (!doc.site) return true
  const house = placedEnvelopeOf(doc)
  if (house.length === 0) return true
  const outside = difference(house, buildableAreaOf(doc.site), FillRule.EvenOdd)
  return Math.abs(areaPaths(outside)) < 0.5
}
