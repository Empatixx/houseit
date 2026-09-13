import type { HouseDocument, Site } from '@houseit/core/document'
import { createEmptyDocument } from '@houseit/core/document'
import { describe, expect, test } from 'vitest'
import {
  buildableAreaOf,
  buildingEnvelopeOf,
  houseFitsSite,
  placedPoint,
  pointInArea,
} from './site'

const squareSite = (size = 10_000): Site => ({
  parcel: {
    id: 'parcel-1',
    nationalReference: '1-1',
    number: '1',
    cadastralAreaCode: '1',
    cadastralAreaName: 'Test',
    areaM2: (size * size) / 1_000_000,
    polygons: [
      {
        outer: [
          { x: 0, y: 0 },
          { x: size, y: 0 },
          { x: size, y: size },
          { x: 0, y: size },
        ],
        holes: [],
      },
    ],
  },
  source: {
    provider: 'cuzk-inspire-cp',
    fetchedAt: '2026-09-13T12:00:00.000Z',
    crs: 'EPSG:5514',
    originXmm: 0,
    originYmm: 0,
    attributionYear: 2026,
  },
  housePlacement: { xMm: 0, yMm: 0, rotationMilliDegrees: 0 },
  setbacks: { defaultMm: 0, byEdge: {} },
})

function rectangularHouse(x0: number, y0: number, x1: number, y1: number, thickness = 200) {
  const doc = createEmptyDocument()
  const level = Object.keys(doc.levels)[0]!
  doc.nodes = {
    n1: { id: 'n1', x: x0, y: y0 },
    n2: { id: 'n2', x: x1, y: y0 },
    n3: { id: 'n3', x: x1, y: y1 },
    n4: { id: 'n4', x: x0, y: y1 },
  }
  doc.walls = {
    w1: { id: 'w1', level, a: 'n1', b: 'n2', thickness, baseOffset: 0, height: 2600 },
    w2: { id: 'w2', level, a: 'n2', b: 'n3', thickness, baseOffset: 0, height: 2600 },
    w3: { id: 'w3', level, a: 'n3', b: 'n4', thickness, baseOffset: 0, height: 2600 },
    w4: { id: 'w4', level, a: 'n4', b: 'n1', thickness, baseOffset: 0, height: 2600 },
  }
  doc.rooms = {
    r1: { id: 'r1', level, x: (x0 + x1) / 2, y: (y0 + y1) / 2, name: 'Room', loop: [] },
  }
  return doc
}

const absoluteArea = (paths: { x: number; y: number }[][]): number =>
  Math.abs(
    paths.reduce((total, path) => {
      let area = 0
      for (let index = 0; index < path.length; index += 1) {
        const point = path[index]!
        const next = path[(index + 1) % path.length]!
        area += point.x * next.y - next.x * point.y
      }
      return total + area / 2
    }, 0),
  )

describe('site coordinates', () => {
  test('places a house point by rotation and translation', () => {
    expect(
      placedPoint(
        { x: 1000, y: 0 },
        { xMm: 5000, yMm: 3000, rotationMilliDegrees: 90_000 },
      ),
    ).toEqual({ x: 5000, y: 4000 })
  })
})

describe('buildable area', () => {
  test('is the whole parcel when no setback is set', () => {
    const area = buildableAreaOf(squareSite())

    expect(absoluteArea(area)).toBe(100_000_000)
    expect(pointInArea({ x: 1, y: 1 }, area)).toBe(true)
  })

  test('shrinks a square by a uniform setback', () => {
    const site = squareSite()
    site.setbacks.defaultMm = 1000

    const area = buildableAreaOf(site)

    expect(absoluteArea(area)).toBe(64_000_000)
    expect(pointInArea({ x: 999, y: 5000 }, area)).toBe(false)
    expect(pointInArea({ x: 1000, y: 5000 }, area)).toBe(true)
  })

  test('applies an override to one parcel edge', () => {
    const site = squareSite()
    site.setbacks.byEdge['p0:r0:e0'] = 2000

    const area = buildableAreaOf(site)

    expect(pointInArea({ x: 5000, y: 1999 }, area)).toBe(false)
    expect(pointInArea({ x: 5000, y: 2001 }, area)).toBe(true)
    expect(pointInArea({ x: 100, y: 5000 }, area)).toBe(true)
  })
})

describe('house fit', () => {
  test('includes half the wall thickness in the building envelope', () => {
    const envelope = buildingEnvelopeOf(rectangularHouse(100, 100, 9900, 9900))

    expect(pointInArea({ x: 0, y: 5000 }, envelope)).toBe(true)
    expect(pointInArea({ x: 10_000, y: 5000 }, envelope)).toBe(true)
  })

  test('allows a wall face on the parcel boundary and refuses one millimetre outside', () => {
    const inside = rectangularHouse(100, 100, 9900, 9900)
    inside.site = squareSite()
    const outside = rectangularHouse(100, 100, 9901, 9900)
    outside.site = squareSite()

    expect(houseFitsSite(inside)).toBe(true)
    expect(houseFitsSite(outside)).toBe(false)
  })

  test('rejects a house crossing the cut-out of a concave parcel', () => {
    const doc = rectangularHouse(1000, 1000, 9000, 9000)
    const site = squareSite()
    site.parcel.polygons[0]!.outer = [
      { x: 0, y: 0 },
      { x: 10_000, y: 0 },
      { x: 10_000, y: 10_000 },
      { x: 6000, y: 10_000 },
      { x: 6000, y: 4000 },
      { x: 4000, y: 4000 },
      { x: 4000, y: 10_000 },
      { x: 0, y: 10_000 },
    ]
    doc.site = site

    expect(houseFitsSite(doc)).toBe(false)
  })

  test('uses every storey when finding the building footprint', () => {
    const doc = rectangularHouse(1000, 1000, 9000, 9000)
    const upper = 'upper'
    doc.levels[upper] = { id: upper, name: 'Upper', elevation: 2800, height: 2800 }
    doc.nodes.u1 = { id: 'u1', x: 9500, y: 4500 }
    doc.nodes.u2 = { id: 'u2', x: 10_500, y: 4500 }
    doc.walls.u1 = {
      id: 'u1',
      level: upper,
      a: 'u1',
      b: 'u2',
      thickness: 200,
      baseOffset: 0,
      height: 2600,
    }
    doc.site = squareSite()

    expect(houseFitsSite(doc as HouseDocument)).toBe(false)
  })
})
