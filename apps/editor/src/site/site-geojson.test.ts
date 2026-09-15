import type { Site } from '@houseit/core/parcel-site'
import { expect, test } from 'vitest'
import { siteGeoJson } from './site-geojson'

test('turns local parcel millimetres back into a closed WGS84 map polygon', () => {
  const site = {
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
          ],
          holes: [],
        },
      ],
    },
    source: {
      provider: 'cuzk-inspire-cp',
      fetchedAt: '2026-09-13T12:00:00.000Z',
      crs: 'EPSG:5514',
      originXmm: -743_965_280,
      originYmm: -1_043_815_650,
      attributionYear: 2026,
    },
    housePlacement: { xMm: 0, yMm: 0, rotationMilliDegrees: 0 },
    setbacks: { defaultMm: 0, byEdge: {} },
  } satisfies Site

  const feature = siteGeoJson(site)
  const ring = feature.geometry.coordinates[0]?.[0]

  expect(feature.geometry.type).toBe('MultiPolygon')
  expect(ring?.at(-1)).toEqual(ring?.[0])
  expect(ring?.[0]?.[0]).toBeGreaterThan(12)
  expect(ring?.[0]?.[0]).toBeLessThan(19)
  expect(ring?.[0]?.[1]).toBeGreaterThan(48)
  expect(ring?.[0]?.[1]).toBeLessThan(52)
})
