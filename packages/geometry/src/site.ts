import type { HouseDocument } from '@houseit/core/document'
import type { PointMm, Site } from '@houseit/core/parcel-site'
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
import { enclosureOf, enclosuresOf, isOutdoor } from './enclosure'
import { roomsOf } from './rooms'

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

export function parcelEdgeIds(site: Site): string[] {
  return site.parcel.polygons.flatMap((polygon, polygonIndex) =>
    [polygon.outer, ...polygon.holes].flatMap((ring, ringIndex) =>
      ring.map((_, edgeIndex) => edgeId(polygonIndex, ringIndex, edgeIndex)),
    ),
  )
}

export function centeredSiteForHouse(doc: HouseDocument, site: Site): Site {
  const rotation = site.housePlacement.rotationMilliDegrees
  const rotatedEnvelope = buildingEnvelopeOf(doc).map((path) =>
    path.map((point) => placedPoint(point, { xMm: 0, yMm: 0, rotationMilliDegrees: rotation })),
  )
  const rotatedHouse = rotatedEnvelope.flat()
  const parcel = site.parcel.polygons.flatMap((polygon) => polygon.outer)
  if (rotatedHouse.length === 0 || parcel.length === 0) return site

  const centre = (points: PointMm[]) => {
    const xs = points.map((point) => point.x)
    const ys = points.map((point) => point.y)
    return {
      x: Math.round((Math.min(...xs) + Math.max(...xs)) / 2),
      y: Math.round((Math.min(...ys) + Math.max(...ys)) / 2),
    }
  }
  const houseCentre = centre(rotatedHouse)
  const parcelCentre = centre(parcel)
  const placementAt = (point: PointMm): Placement => ({
    xMm: point.x - houseCentre.x,
    yMm: point.y - houseCentre.y,
    rotationMilliDegrees: rotation,
  })
  const buildable = buildableAreaOf(site)
  const fits = (placement: Placement) => {
    const placed = rotatedEnvelope.map((path) =>
      path.map((point) => ({ x: point.x + placement.xMm, y: point.y + placement.yMm })),
    )
    return Math.abs(areaPaths(difference(placed, buildable, FillRule.EvenOdd))) < 0.5
  }
  const centred = placementAt(parcelCentre)
  if (fits(centred)) return { ...site, housePlacement: centred }

  const bounds = (points: PointMm[]) => ({
    left: Math.min(...points.map((point) => point.x)),
    top: Math.min(...points.map((point) => point.y)),
    right: Math.max(...points.map((point) => point.x)),
    bottom: Math.max(...points.map((point) => point.y)),
  })
  const houseBounds = bounds(rotatedHouse)
  const relative = {
    left: houseBounds.left - houseCentre.x,
    top: houseBounds.top - houseCentre.y,
    right: houseBounds.right - houseCentre.x,
    bottom: houseBounds.bottom - houseCentre.y,
  }
  const candidates: PointMm[] = []

  for (const path of buildable) {
    if (path.length < 3) continue
    const areaBounds = bounds(path)
    const left = areaBounds.left - relative.left
    const right = areaBounds.right - relative.right
    const top = areaBounds.top - relative.top
    const bottom = areaBounds.bottom - relative.bottom
    if (left > right || top > bottom) continue

    const coordinates = (
      start: number,
      end: number,
      houseSpan: number,
      vertices: number[],
      before: number,
      after: number,
    ) => {
      const values = new Set<number>([start, end, Math.round((start + end) / 2)])
      const divisions = Math.min(
        64,
        Math.max(1, Math.ceil((end - start) / Math.max(250, houseSpan / 2))),
      )
      for (let index = 0; index <= divisions; index += 1) {
        values.add(Math.round(start + ((end - start) * index) / divisions))
      }
      const vertexStep = Math.max(1, Math.ceil(vertices.length / 64))
      for (let index = 0; index < vertices.length; index += vertexStep) {
        const value = vertices[index]!
        values.add(value - before)
        values.add(value - after)
      }
      return [...values].filter((value) => value >= start && value <= end)
    }
    const xs = coordinates(
      left,
      right,
      houseBounds.right - houseBounds.left,
      path.map((point) => point.x),
      relative.left,
      relative.right,
    )
    const ys = coordinates(
      top,
      bottom,
      houseBounds.bottom - houseBounds.top,
      path.map((point) => point.y),
      relative.top,
      relative.bottom,
    )
    for (const x of xs) for (const y of ys) candidates.push({ x, y })
  }

  candidates.sort(
    (a, b) =>
      (a.x - parcelCentre.x) ** 2 +
      (a.y - parcelCentre.y) ** 2 -
      ((b.x - parcelCentre.x) ** 2 + (b.y - parcelCentre.y) ** 2),
  )
  const found = candidates.map(placementAt).find(fits)
  return { ...site, housePlacement: found ?? centred }
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
    const rooms = roomsOf(doc, level)
    const enclosures = enclosuresOf(doc, level, rooms)
    for (const room of rooms) {
      if (isOutdoor(room)) continue
      paths.push(room.nodes.map((node) => doc.nodes[node]!).filter(Boolean))
    }

    for (const wall of Object.values(doc.walls)) {
      if (wall.level !== level || enclosureOf(enclosures, wall.id) === 'edge') continue
      const a = doc.nodes[wall.a]
      const b = doc.nodes[wall.b]
      if (!a || !b || (a.x === b.x && a.y === b.y)) continue
      paths.push(...inflatePaths([[a, b]], wall.thickness / 2, JoinType.Square, EndType.Square))
    }
  }

  return paths.length === 0 ? [] : union(paths, FillRule.NonZero)
}

export function outdoorSurfacesOf(doc: HouseDocument): SiteArea {
  const paths: Paths64 = []
  for (const level of Object.keys(doc.levels)) {
    for (const room of roomsOf(doc, level)) {
      if (!isOutdoor(room)) continue
      paths.push(room.nodes.map((node) => doc.nodes[node]!).filter(Boolean))
    }
  }
  return paths.length === 0 ? [] : union(paths, FillRule.NonZero)
}

const SLIVER = 50_000

export function surfacesFitParcel(doc: HouseDocument): boolean {
  if (!doc.parcelSite) return true
  const placement = doc.parcelSite.housePlacement
  const surfaces = outdoorSurfacesOf(doc).map((path) =>
    path.map((point) => placedPoint(point, placement)),
  )
  if (surfaces.length === 0) return true
  const outside = difference(surfaces, parcelAreaOf(doc.parcelSite), FillRule.EvenOdd)
  return Math.abs(areaPaths(outside)) < SLIVER
}

export function placedEnvelopeOf(doc: HouseDocument): SiteArea {
  const envelope = buildingEnvelopeOf(doc)
  if (!doc.parcelSite) return envelope
  return envelope.map((path) =>
    path.map((point) => placedPoint(point, doc.parcelSite!.housePlacement)),
  )
}

export function houseFitsSite(doc: HouseDocument): boolean {
  if (!doc.parcelSite) return true
  const house = placedEnvelopeOf(doc)
  if (house.length === 0) return true
  const outside = difference(house, buildableAreaOf(doc.parcelSite), FillRule.EvenOdd)
  return Math.abs(areaPaths(outside)) < 0.5
}
