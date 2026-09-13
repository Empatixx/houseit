import type { Site } from '@houseit/core/document'
import {
  Layer,
  Map as MapGL,
  type MapLayerMouseEvent,
  type MapRef,
  NavigationControl,
  Source,
} from '@vis.gl/react-maplibre'
import { forwardRef } from 'react'
import type { ParcelGateway } from './parcel-gateway'
import { siteGeoJson } from './site-geojson'
import 'maplibre-gl/dist/maplibre-gl.css'

const EMPTY_STYLE = { version: 8 as const, sources: {}, layers: [] }

type Props = {
  selected: Site | null
  gateway: ParcelGateway
  onSelect: (site: Site | null) => void
  onBusy: (busy: boolean) => void
  onError: (message: string) => void
}

export const ParcelMap = forwardRef<MapRef, Props>(function ParcelMap(
  { selected, gateway, onSelect, onBusy, onError },
  ref,
) {
  const pick = async (event: MapLayerMouseEvent) => {
    onBusy(true)
    onError('')
    try {
      onSelect(
        await gateway.findAt({ longitude: event.lngLat.lng, latitude: event.lngLat.lat }),
      )
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error))
    } finally {
      onBusy(false)
    }
  }

  return (
    <MapGL
      ref={ref}
      initialViewState={{ longitude: 15.45, latitude: 49.8, zoom: 7 }}
      mapStyle={EMPTY_STYLE}
      onClick={(event) => void pick(event)}
      cursor="crosshair"
      attributionControl={false}
    >
      <NavigationControl position="bottom-right" showCompass={false} />
      <Source
        id="cuzk-base"
        type="raster"
        tiles={[
          'https://ags.cuzk.gov.cz/arcgis1/rest/services/ZTM_WM/MapServer/tile/{z}/{y}/{x}',
        ]}
        tileSize={256}
        maxzoom={23}
      >
        <Layer id="cuzk-base" type="raster" />
      </Source>
      <Source
        id="cuzk-cadastre"
        type="raster"
        tiles={[
          'https://services.cuzk.cz/wmts/local-km-wmts-google/rest/WMTS/default/KN/{z}/{y}/{x}',
        ]}
        tileSize={256}
        minzoom={17}
        maxzoom={25}
      >
        <Layer id="cuzk-cadastre" type="raster" minzoom={16.5} paint={{ 'raster-opacity': 0.9 }} />
      </Source>
      {selected ? (
        <Source id="selected-parcel" type="geojson" data={siteGeoJson(selected)}>
          <Layer
            id="selected-parcel-fill"
            type="fill"
            paint={{ 'fill-color': '#714cb6', 'fill-opacity': 0.22 }}
          />
          <Layer
            id="selected-parcel-line"
            type="line"
            paint={{ 'line-color': '#5b35a4', 'line-width': 3 }}
          />
        </Source>
      ) : null}
      <div className="pointer-events-none absolute right-2 bottom-1 rounded bg-white/85 px-1.5 py-0.5 text-[10px] text-neutral-700">
        © ČÚZK, {new Date().getFullYear()}
      </div>
    </MapGL>
  )
})
