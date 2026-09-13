import type { Site } from '@houseit/core/document'
import { expect, test } from 'vitest'
import { drawingOfSite } from './site-drawing'

const site: Site = {
  parcel: {
    id: 'parcel-1',
    nationalReference: '1-1',
    number: '1',
    cadastralAreaCode: '1',
    cadastralAreaName: 'Test',
    areaM2: 100,
    polygons: [
      {
        outer: [
          { x: 0, y: 0 },
          { x: 10_000, y: 0 },
          { x: 10_000, y: 10_000 },
          { x: 0, y: 10_000 },
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
  housePlacement: { xMm: 1000, yMm: 2000, rotationMilliDegrees: 0 },
  setbacks: { defaultMm: 1000, byEdge: { 'p0:r0:e0': 2000 } },
}

test('prepares parcel, buildable and edge geometry in house coordinates', () => {
  const drawing = drawingOfSite(site)

  expect(drawing.parcels[0]?.outer[0]).toEqual({ x: -1000, y: -2000 })
  expect(drawing.edges.map((edge) => edge.id)).toEqual([
    'p0:r0:e0',
    'p0:r0:e1',
    'p0:r0:e2',
    'p0:r0:e3',
  ])
  expect(drawing.edges.map((edge) => edge.number)).toEqual([1, 2, 3, 4])
  expect(drawing.edges[0]?.setbackMm).toBe(2000)
  expect(drawing.edges[1]?.setbackMm).toBe(1000)
  expect(drawing.buildable.length).toBeGreaterThan(0)
})
