import type { Site } from '@houseit/core/parcel-site'
import { CuzkResponseError, parseParcelGml, parseZoningCode, siteFromParcel } from './gml'
import { type LngLat, toSjtsk } from './projection'

const WFS = 'https://services.cuzk.gov.cz/wfs/inspire-cp-wfs.asp'

export type ParcelGateway = {
  findByNumber(area: string, number: string): Promise<Site | null>
  findAt(point: LngLat): Promise<Site | null>
}

type Options = {
  fetcher?: typeof fetch
  now?: () => Date
  timeoutMs?: number
}

export function createCuzkParcelGateway({
  fetcher = fetch,
  now = () => new Date(),
  timeoutMs = 12_000,
}: Options = {}): ParcelGateway {
  const request = async (parameters: Record<string, string>): Promise<string> => {
    const url = new URL(WFS)
    const common = { service: 'WFS', version: '2.0.0', request: 'GetFeature' }
    for (const [name, value] of Object.entries({ ...common, ...parameters })) {
      url.searchParams.set(name, value)
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetcher(url, { signal: controller.signal })
      if (!response.ok) throw new CuzkResponseError(`ČÚZK request failed (${response.status})`)
      return await response.text()
    } catch (error) {
      if (controller.signal.aborted) throw new CuzkResponseError('ČÚZK request timed out')
      throw error
    } finally {
      clearTimeout(timer)
    }
  }

  const asSite = (xml: string): Site | null => {
    if (/numberReturned=["']0["']/.test(xml)) return null
    return siteFromParcel(parseParcelGml(xml), now().toISOString())
  }

  return {
    async findByNumber(area, number) {
      const trimmedArea = area.trim()
      const areaCode = /^\d{6}$/.test(trimmedArea)
        ? trimmedArea
        : parseZoningCode(
            await request({ storedQuery_id: 'GetZoningByName', ZONING_NAME: trimmedArea }),
          )
      return asSite(
        await request({
          storedQuery_id: 'GetParcel',
          UPPER_ZONING_ID: areaCode,
          TEXT: number.trim(),
          srsName: 'EPSG:5514',
        }),
      )
    },

    async findAt(point) {
      const projected = toSjtsk(point)
      return asSite(
        await request({
          storedQuery_id: 'GetFeatureByPoint',
          POINT: `${projected.x.toFixed(2)},${projected.y.toFixed(2)}`,
          FEATURE_TYPE: 'CadastralParcel',
          DISTANCE: '0',
          srsName: 'EPSG:5514',
        }),
      )
    },
  }
}
