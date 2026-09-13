import { describe, expect, test, vi } from 'vitest'
import fixture from './fixtures/smichov-211-8.gml?raw'
import { createCuzkParcelGateway } from './parcel-gateway'

const zoning = `<?xml version="1.0"?><FeatureCollection xmlns="http://www.opengis.net/wfs/2.0" xmlns:cp="http://inspire.ec.europa.eu/schemas/cp/4.0" xmlns:gml="http://www.opengis.net/gml/3.2"><member><cp:CadastralZoning gml:id="CZ.729051"><cp:name>Smíchov</cp:name></cp:CadastralZoning></member></FeatureCollection>`

const response = (body: string, ok = true): Response =>
  ({ ok, status: ok ? 200 : 503, text: async () => body }) as Response

describe('ČÚZK parcel gateway', () => {
  test('resolves a cadastral area name and then its parcel number', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(zoning))
      .mockResolvedValueOnce(response(fixture))
    const gateway = createCuzkParcelGateway({ fetcher, now: () => new Date('2026-09-13') })

    const site = await gateway.findByNumber('Smíchov', '211/8')

    expect(site?.parcel.id).toBe('CP.30317058010')
    const zoningUrl = new URL(String(fetcher.mock.calls[0]?.[0]))
    const parcelUrl = new URL(String(fetcher.mock.calls[1]?.[0]))
    expect(zoningUrl.searchParams.get('storedQuery_id')).toBe('GetZoningByName')
    expect(zoningUrl.searchParams.get('ZONING_NAME')).toBe('Smíchov')
    expect(parcelUrl.searchParams.get('UPPER_ZONING_ID')).toBe('729051')
    expect(parcelUrl.searchParams.get('TEXT')).toBe('211/8')
  })

  test('selects a cadastral parcel at a map point in EPSG:5514', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(fixture))
    const gateway = createCuzkParcelGateway({ fetcher })

    await gateway.findAt({ longitude: 14.404, latitude: 50.072 })

    const url = new URL(String(fetcher.mock.calls[0]?.[0]))
    expect(url.searchParams.get('storedQuery_id')).toBe('GetFeatureByPoint')
    expect(url.searchParams.get('FEATURE_TYPE')).toBe('CadastralParcel')
    expect(url.searchParams.get('POINT')).toMatch(/^-\d+\.\d+,-\d+\.\d+$/)
    expect(url.searchParams.get('srsName')).toBe('EPSG:5514')
  })

  test('returns null when the service finds no parcel', async () => {
    const empty = '<FeatureCollection xmlns="http://www.opengis.net/wfs/2.0" numberReturned="0" />'
    const gateway = createCuzkParcelGateway({ fetcher: vi.fn<typeof fetch>().mockResolvedValue(response(empty)) })

    await expect(gateway.findAt({ longitude: 14.4, latitude: 50 })).resolves.toBeNull()
  })

  test('reports a service timeout', async () => {
    const fetcher = vi.fn<typeof fetch>((_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      }),
    )
    const gateway = createCuzkParcelGateway({ fetcher, timeoutMs: 1 })

    await expect(gateway.findAt({ longitude: 14.4, latitude: 50 })).rejects.toThrow(/timed out/i)
  })
})
