import type { LngLat } from './projection'

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'

export type GeocoderResult = LngLat & { label: string }

export type GeocoderGateway = {
  searchOnce(query: string): Promise<GeocoderResult[]>
}

export function createNominatimGeocoder({
  fetcher = fetch,
  endpoint = NOMINATIM,
}: { fetcher?: typeof fetch; endpoint?: string } = {}): GeocoderGateway {
  return {
    async searchOnce(query) {
      const trimmed = query.trim()
      if (!trimmed) return []
      const url = new URL(endpoint)
      url.searchParams.set('q', trimmed)
      url.searchParams.set('format', 'jsonv2')
      url.searchParams.set('countrycodes', 'cz')
      url.searchParams.set('limit', '5')
      const response = await fetcher(url)
      if (!response.ok) throw new Error(`Address search failed (${response.status})`)
      const rows = (await response.json()) as Array<{
        display_name?: unknown
        lon?: unknown
        lat?: unknown
      }>
      return rows.flatMap((row) => {
        const longitude = Number(row.lon)
        const latitude = Number(row.lat)
        if (
          typeof row.display_name !== 'string' ||
          !Number.isFinite(longitude) ||
          !Number.isFinite(latitude)
        ) {
          return []
        }
        return [{ label: row.display_name, longitude, latitude }]
      })
    },
  }
}
