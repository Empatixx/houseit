import { describe, expect, test } from 'vitest'
import { createEmptyDocument, DOCUMENT_VERSION, parseDocument } from './document'

describe('createEmptyDocument', () => {
  test('starts with a single ground level and nothing drawn on it', () => {
    const doc = createEmptyDocument()

    expect(doc.version).toBe(DOCUMENT_VERSION)
    expect(Object.keys(doc.levels)).toHaveLength(1)
    expect(doc.nodes).toEqual({})
    expect(doc.walls).toEqual({})
    expect(doc.site).toBeUndefined()
  })

  test('produces a document that its own schema accepts', () => {
    expect(() => parseDocument(createEmptyDocument())).not.toThrow()
  })
})

describe('parseDocument', () => {
  test('accepts one normalized cadastral parcel site', () => {
    const doc = createEmptyDocument()
    const site = {
      parcel: {
        id: 'CP.30317058010',
        nationalReference: '729051-211/8',
        number: '211/8',
        cadastralAreaCode: '729051',
        cadastralAreaName: 'Smíchov',
        areaM2: 850,
        polygons: [
          {
            outer: [
              { x: 0, y: 0 },
              { x: 20_000, y: 0 },
              { x: 20_000, y: 40_000 },
              { x: 0, y: 40_000 },
            ],
            holes: [],
          },
        ],
      },
      source: {
        provider: 'cuzk-inspire-cp' as const,
        fetchedAt: '2026-09-13T12:00:00.000Z',
        crs: 'EPSG:5514' as const,
        originXmm: -743_000_000,
        originYmm: -1_043_000_000,
        attributionYear: 2026,
      },
      housePlacement: { xMm: 10_000, yMm: 20_000, rotationMilliDegrees: 0 },
      setbacks: { defaultMm: 0, byEdge: {} },
    }

    expect(parseDocument({ ...doc, parcelSite: site }).parcelSite).toEqual(site)
  })

  test('rejects fractional millimetres in a parcel', () => {
    const doc = createEmptyDocument()
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
              { x: 0.5, y: 0 },
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
        originXmm: 0,
        originYmm: 0,
        attributionYear: 2026,
      },
      housePlacement: { xMm: 0, yMm: 0, rotationMilliDegrees: 0 },
      setbacks: { defaultMm: 0, byEdge: {} },
    }

    expect(() => parseDocument({ ...doc, parcelSite: site })).toThrow()
  })

  test('rejects a wall whose endpoint node is missing', () => {
    const doc = createEmptyDocument()
    const level = Object.keys(doc.levels)[0]!
    const broken = {
      ...doc,
      nodes: { n1: { id: 'n1', x: 0, y: 0 } },
      walls: {
        w1: {
          id: 'w1',
          level,
          a: 'n1',
          b: 'n-missing',
          thickness: 150,
          baseOffset: 0,
          height: 2600,
        },
      },
    }

    expect(() => parseDocument(broken)).toThrow(/n-missing/)
  })

  test('rejects a length that is not a whole millimetre', () => {
    const doc = createEmptyDocument()
    const broken = { ...doc, nodes: { n1: { id: 'n1', x: 0.5, y: 0 } } }

    expect(() => parseDocument(broken)).toThrow()
  })
})
