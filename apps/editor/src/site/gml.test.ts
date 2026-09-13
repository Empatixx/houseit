import { describe, expect, test } from 'vitest'
import fixture from './fixtures/smichov-211-8.gml?raw'
import { parseParcelGml, siteFromParcel } from './gml'

describe('ČÚZK parcel GML', () => {
  test('reads identity, area and the real S-JTSK parcel ring', () => {
    const parcel = parseParcelGml(fixture)

    expect(parcel).toMatchObject({
      id: 'CP.30317058010',
      nationalReference: '729051-211/8',
      number: '211/8',
      cadastralAreaCode: '729051',
      cadastralAreaName: 'Smíchov',
      areaM2: 850,
    })
    expect(parcel.polygons).toHaveLength(1)
    expect(parcel.polygons[0]?.outer[0]).toEqual({ x: -743965.28, y: -1043815.65 })
    expect(parcel.polygons[0]?.outer.at(-1)).not.toEqual(parcel.polygons[0]?.outer[0])
  })

  test('normalizes metres to local integer millimetres and keeps the national origin', () => {
    const normalized = siteFromParcel(parseParcelGml(fixture), '2026-09-13T12:00:00.000Z')

    expect(normalized.source).toMatchObject({
      crs: 'EPSG:5514',
      originXmm: -743_965_280,
      originYmm: -1_043_815_650,
    })
    expect(normalized.parcel.polygons[0]?.outer.slice(0, 2)).toEqual([
      { x: 0, y: 0 },
      { x: -610, y: -6630 },
    ])
    expect(normalized.setbacks).toEqual({ defaultMm: 0, byEdge: {} })
  })

  test('reads every polygon and interior ring of a MultiSurface', () => {
    const xml = fixture
      .replace(
        '<gml:Polygon gml:id="P.CP.30317058010" srsName="EPSG:5514" srsDimension="2">',
        '<gml:MultiSurface><gml:surfaceMember><gml:Polygon gml:id="P.CP.30317058010" srsName="EPSG:5514" srsDimension="2">',
      )
      .replace(
        '</gml:Polygon>',
        '<gml:interior><gml:LinearRing><gml:posList>-743964 -1043814 -743963 -1043814 -743963 -1043813 -743964 -1043814</gml:posList></gml:LinearRing></gml:interior></gml:Polygon></gml:surfaceMember></gml:MultiSurface>',
      )

    const parcel = parseParcelGml(xml)

    expect(parcel.polygons).toHaveLength(1)
    expect(parcel.polygons[0]?.holes).toHaveLength(1)
  })

  test('surfaces an OGC exception instead of reporting an empty parcel', () => {
    const exception = `<?xml version="1.0"?><ExceptionReport xmlns="http://www.opengis.net/ows/1.1"><Exception><ExceptionText>Bad point</ExceptionText></Exception></ExceptionReport>`

    expect(() => parseParcelGml(exception)).toThrow(/Bad point/)
  })
})
