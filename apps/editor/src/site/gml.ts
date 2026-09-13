import type { ParcelPolygon, Site } from '@houseit/core/document'

export type MetricPoint = { x: number; y: number }

export type RemoteParcel = {
  id: string
  nationalReference: string
  number: string
  cadastralAreaCode: string
  cadastralAreaName: string
  areaM2: number
  polygons: Array<{ outer: MetricPoint[]; holes: MetricPoint[][] }>
}

export class CuzkResponseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CuzkResponseError'
  }
}

export function parseParcelGml(source: string): RemoteParcel {
  const xml = parseXml(source)
  const exception = first(xml, 'ExceptionText')?.textContent?.trim()
  if (exception) throw new CuzkResponseError(exception)

  const parcel = first(xml, 'CadastralParcel')
  if (!parcel) throw new CuzkResponseError('ČÚZK did not return a cadastral parcel')

  const nationalReference = textOf(parcel, 'nationalCadastralReference')
  const zoning = first(parcel, 'zoning')
  const areaCode = nationalReference.split('-', 1)[0] ?? ''
  const polygons = all(parcel, 'Polygon').map((polygon) => {
    const exterior = first(polygon, 'exterior')
    if (!exterior) throw new CuzkResponseError('The parcel polygon has no exterior ring')
    return {
      outer: ringOf(exterior),
      holes: all(polygon, 'interior').map(ringOf),
    }
  })
  if (polygons.length === 0) throw new CuzkResponseError('The parcel has no polygon geometry')

  return {
    id: attributeOf(parcel, 'id') || textOf(parcel, 'localId'),
    nationalReference,
    number: textOf(parcel, 'label'),
    cadastralAreaCode: areaCode,
    cadastralAreaName: zoning ? attributeOf(zoning, 'title') : areaCode,
    areaM2: numberOf(parcel, 'areaValue'),
    polygons,
  }
}

export function parseZoningCode(source: string): string {
  const xml = parseXml(source)
  const exception = first(xml, 'ExceptionText')?.textContent?.trim()
  if (exception) throw new CuzkResponseError(exception)
  const zoning = first(xml, 'CadastralZoning')
  if (!zoning) throw new CuzkResponseError('ČÚZK did not find that cadastral area')
  return attributeOf(zoning, 'id').replace(/^CZ\./, '')
}

export function siteFromParcel(parcel: RemoteParcel, fetchedAt = new Date().toISOString()): Site {
  const origin = parcel.polygons[0]!.outer[0]!
  const originXmm = Math.round(origin.x * 1000)
  const originYmm = Math.round(origin.y * 1000)
  const local = ({ x, y }: MetricPoint) => ({
    x: Math.round(x * 1000 - originXmm),
    y: Math.round(y * 1000 - originYmm),
  })
  const polygons: ParcelPolygon[] = parcel.polygons.map((polygon) => ({
    outer: polygon.outer.map(local),
    holes: polygon.holes.map((ring) => ring.map(local)),
  }))
  const outer = polygons.flatMap((polygon) => polygon.outer)
  const xs = outer.map((point) => point.x)
  const ys = outer.map((point) => point.y)

  return {
    parcel: {
      id: parcel.id,
      nationalReference: parcel.nationalReference,
      number: parcel.number,
      cadastralAreaCode: parcel.cadastralAreaCode,
      cadastralAreaName: parcel.cadastralAreaName,
      areaM2: parcel.areaM2,
      polygons,
    },
    source: {
      provider: 'cuzk-inspire-cp',
      fetchedAt,
      crs: 'EPSG:5514',
      originXmm,
      originYmm,
      attributionYear: new Date(fetchedAt).getUTCFullYear(),
    },
    housePlacement: {
      xMm: Math.round((Math.min(...xs) + Math.max(...xs)) / 2),
      yMm: Math.round((Math.min(...ys) + Math.max(...ys)) / 2),
      rotationMilliDegrees: 0,
    },
    setbacks: { defaultMm: 0, byEdge: {} },
  }
}

function parseXml(source: string): XMLDocument {
  const xml = new DOMParser().parseFromString(source, 'application/xml')
  const error = first(xml, 'parsererror')?.textContent?.trim()
  if (error) throw new CuzkResponseError(`ČÚZK returned invalid XML: ${error}`)
  return xml
}

function all(root: Document | Element, localName: string): Element[] {
  return Array.from(root.getElementsByTagName('*')).filter(
    (element) => element.localName === localName,
  )
}

function first(root: Document | Element, localName: string): Element | undefined {
  return all(root, localName)[0]
}

function textOf(root: Element, localName: string): string {
  const value = first(root, localName)?.textContent?.trim()
  if (!value) throw new CuzkResponseError(`ČÚZK response is missing ${localName}`)
  return value
}

function numberOf(root: Element, localName: string): number {
  const value = Number(textOf(root, localName))
  if (!Number.isFinite(value)) throw new CuzkResponseError(`${localName} is not a number`)
  return value
}

function attributeOf(element: Element, localName: string): string {
  const attribute = Array.from(element.attributes).find((entry) => entry.localName === localName)
  return attribute?.value ?? ''
}

function ringOf(container: Element): MetricPoint[] {
  const numbers = textOf(container, 'posList').split(/\s+/).map(Number)
  if (
    numbers.length < 8 ||
    numbers.length % 2 !== 0 ||
    numbers.some((value) => !Number.isFinite(value))
  ) {
    throw new CuzkResponseError('The parcel contains an invalid coordinate list')
  }
  const points: MetricPoint[] = []
  for (let index = 0; index < numbers.length; index += 2) {
    points.push({ x: numbers[index]!, y: numbers[index + 1]! })
  }
  const firstPoint = points[0]!
  const lastPoint = points.at(-1)!
  if (firstPoint.x === lastPoint.x && firstPoint.y === lastPoint.y) points.pop()
  return points
}
