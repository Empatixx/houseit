import { expect, test, vi } from 'vitest'
import { createNominatimGeocoder } from './geocoder-gateway'

test('searches Czech addresses once per explicit call without autocomplete state', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => [
      { display_name: 'Radlická, Praha, Česko', lon: '14.401', lat: '50.061' },
    ],
  } as Response)
  const geocoder = createNominatimGeocoder({ fetcher })

  const results = await geocoder.searchOnce('Radlická Praha')

  expect(fetcher).toHaveBeenCalledTimes(1)
  const url = new URL(String(fetcher.mock.calls[0]?.[0]))
  expect(url.searchParams.get('q')).toBe('Radlická Praha')
  expect(url.searchParams.get('countrycodes')).toBe('cz')
  expect(results).toEqual([
    { label: 'Radlická, Praha, Česko', longitude: 14.401, latitude: 50.061 },
  ])
})

test('does not send an empty address query', async () => {
  const fetcher = vi.fn<typeof fetch>()
  const geocoder = createNominatimGeocoder({ fetcher })

  await expect(geocoder.searchOnce('   ')).resolves.toEqual([])
  expect(fetcher).not.toHaveBeenCalled()
})
