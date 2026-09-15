import proj4 from 'proj4'

const WGS84 = 'EPSG:4326'
const S_JTSK = 'EPSG:5514'

proj4.defs(
  S_JTSK,
  '+proj=krovak +lat_0=49.5 +lon_0=24.8333333333333 +alpha=30.2881397527778 +k=0.9999 +x_0=0 +y_0=0 +ellps=bessel +towgs84=589,76,480,0,0,0,0 +units=m +no_defs +type=crs',
)

export type LngLat = { longitude: number; latitude: number }
export type SjtskPoint = { x: number; y: number }

export function toSjtsk(point: LngLat): SjtskPoint {
  const [x, y] = proj4(WGS84, S_JTSK, [point.longitude, point.latitude])
  return { x, y }
}

export function toLngLat(point: SjtskPoint): LngLat {
  const [longitude, latitude] = proj4(S_JTSK, WGS84, [point.x, point.y])
  return { longitude, latitude }
}
