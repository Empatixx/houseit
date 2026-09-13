import type { Site } from '@houseit/core/document'
import type { MapRef } from '@vis.gl/react-maplibre'
import { LoaderCircleIcon, MapPinIcon, SearchIcon, XIcon } from 'lucide-react'
import { type FormEvent, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createNominatimGeocoder, type GeocoderGateway, type GeocoderResult } from './geocoder-gateway'
import { createCuzkParcelGateway, type ParcelGateway } from './parcel-gateway'
import { ParcelMap } from './parcel-map'
import {
  type SiteDialogRequest,
  siteDialogStore,
  useSiteDialog,
} from './site-dialog-store'
import { siteGeoJson } from './site-geojson'

type Props = {
  onConfirm: (site: Site, request: SiteDialogRequest) => Promise<void> | void
  parcelGateway?: ParcelGateway
  geocoder?: GeocoderGateway
}

export function ParcelPicker({ onConfirm, parcelGateway, geocoder }: Props) {
  const request = useSiteDialog((state) => state.request)
  const selected = useSiteDialog((state) => state.pending)
  const gateway = useMemo(() => parcelGateway ?? createCuzkParcelGateway(), [parcelGateway])
  const addressGateway = useMemo(() => geocoder ?? createNominatimGeocoder(), [geocoder])
  const map = useRef<MapRef>(null)
  const [mode, setMode] = useState<'parcel' | 'address'>('parcel')
  const [area, setArea] = useState('')
  const [number, setNumber] = useState('')
  const [address, setAddress] = useState('')
  const [results, setResults] = useState<GeocoderResult[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!request) return null

  const choose = (site: Site | null) => {
    siteDialogStore.getState().select(site)
    if (site) fitSite(map.current, site)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setResults([])
    try {
      if (mode === 'parcel') {
        const found = await gateway.findByNumber(area, number)
        if (!found) setError('No parcel was found.')
        choose(found)
      } else {
        const found = await addressGateway.searchOnce(address)
        setResults(found)
        if (found.length === 0) setError('No address was found.')
        if (found.length === 1) goTo(map.current, found[0]!)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  const confirm = async () => {
    if (!selected) return
    setBusy(true)
    setError('')
    try {
      await onConfirm(selected, request)
      siteDialogStore.getState().close()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true" aria-label="Choose a parcel">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4">
        <div className="flex size-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <MapPinIcon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold">Choose a parcel</h1>
          <p className="truncate text-xs text-muted-foreground">
            Search the Czech cadastre or click directly on the map.
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close parcel map" onClick={() => siteDialogStore.getState().close()}>
          <XIcon />
        </Button>
      </header>

      <div className="relative min-h-0 flex-1">
        <ParcelMap
          ref={map}
          selected={selected}
          gateway={gateway}
          onSelect={choose}
          onBusy={setBusy}
          onError={setError}
        />

        <form onSubmit={(event) => void submit(event)} className="glass absolute top-3 left-3 w-[min(28rem,calc(100%-1.5rem))] rounded-xl border p-3 shadow-xl">
          <div className="mb-3 flex rounded-lg bg-muted p-1 text-sm">
            <button type="button" className={`flex-1 rounded-md px-3 py-1.5 ${mode === 'parcel' ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground'}`} onClick={() => setMode('parcel')}>
              Parcel number
            </button>
            <button type="button" className={`flex-1 rounded-md px-3 py-1.5 ${mode === 'address' ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground'}`} onClick={() => setMode('address')}>
              Address
            </button>
          </div>
          {mode === 'parcel' ? (
            <div className="grid grid-cols-[1fr_7rem_auto] gap-2">
              <Input value={area} onChange={(event) => setArea(event.target.value)} placeholder="Cadastral area" aria-label="Cadastral area" required />
              <Input value={number} onChange={(event) => setNumber(event.target.value)} placeholder="211/8" aria-label="Parcel number" required />
              <Button type="submit" size="icon" aria-label="Find parcel" disabled={busy}><SearchIcon /></Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Address or place" aria-label="Address" required />
              <Button type="submit" size="icon" aria-label="Find address" disabled={busy}><SearchIcon /></Button>
            </div>
          )}
          {results.length > 1 ? (
            <ul className="mt-2 max-h-44 overflow-auto rounded-lg border bg-background">
              {results.map((result) => (
                <li key={`${result.longitude}:${result.latitude}`}>
                  <button type="button" className="w-full px-3 py-2 text-left text-xs hover:bg-muted" onClick={() => goTo(map.current, result)}>
                    {result.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {error ? <p role="alert" className="mt-2 text-xs text-destructive">{error}</p> : null}
          {busy ? <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><LoaderCircleIcon className="size-3 animate-spin" /> Loading…</p> : null}
        </form>

        <aside className="glass absolute right-3 bottom-3 w-[min(22rem,calc(100%-1.5rem))] rounded-xl border p-4 shadow-xl">
          {selected ? (
            <>
              <p className="text-xs font-medium text-muted-foreground">Selected parcel</p>
              <p className="mt-1 text-lg font-semibold">{selected.parcel.number}</p>
              <p className="text-sm">{selected.parcel.cadastralAreaName}</p>
              <p className="mt-1 text-xs text-muted-foreground">{selected.parcel.areaM2.toLocaleString('cs-CZ')} m² · ČÚZK</p>
              <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs leading-4 text-amber-900">
                Indicative data. Verify boundaries and siting with a surveyor for project work.
              </p>
              <Button className="mt-3 w-full" disabled={busy} onClick={() => void confirm()}>
                {request.kind === 'create' ? 'Create project on this parcel' : 'Use this parcel'}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Search or click a parcel on the map.</p>
          )}
        </aside>
      </div>
    </div>
  )
}

function goTo(map: MapRef | null, result: GeocoderResult): void {
  map?.flyTo({ center: [result.longitude, result.latitude], zoom: 17 })
}

function fitSite(map: MapRef | null, site: Site): void {
  const coordinates = siteGeoJson(site).geometry.coordinates.flat(2)
  if (coordinates.length === 0) return
  const longitudes = coordinates.map((coordinate) => coordinate[0]!)
  const latitudes = coordinates.map((coordinate) => coordinate[1]!)
  map?.fitBounds(
    [
      [Math.min(...longitudes), Math.min(...latitudes)],
      [Math.max(...longitudes), Math.max(...latitudes)],
    ],
    { padding: 80, maxZoom: 20 },
  )
}
