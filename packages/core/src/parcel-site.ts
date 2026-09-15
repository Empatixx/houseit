import { z } from 'zod'

const mm = z.number().int()
const id = z.string().min(1)
export const PointMmSchema = z.object({ x: mm, y: mm })

export const ParcelPolygonSchema = z.object({
  outer: z.array(PointMmSchema).min(3),
  holes: z.array(z.array(PointMmSchema).min(3)),
})

export const SiteSchema = z.object({
  parcel: z.object({
    id,
    nationalReference: z.string().min(1),
    number: z.string().min(1),
    cadastralAreaCode: z.string().min(1),
    cadastralAreaName: z.string().min(1),
    areaM2: z.number().positive(),
    polygons: z.array(ParcelPolygonSchema).min(1),
  }),
  source: z.object({
    provider: z.literal('cuzk-inspire-cp'),
    fetchedAt: z.iso.datetime(),
    crs: z.literal('EPSG:5514'),
    originXmm: mm,
    originYmm: mm,
    attributionYear: z.number().int().positive(),
  }),
  housePlacement: z.object({
    xMm: mm,
    yMm: mm,
    rotationMilliDegrees: mm,
  }),
  setbacks: z.object({
    defaultMm: mm.nonnegative(),
    byEdge: z.record(z.string(), mm.nonnegative()),
  }),
})

export type PointMm = z.infer<typeof PointMmSchema>
export type ParcelPolygon = z.infer<typeof ParcelPolygonSchema>
export type Site = z.infer<typeof SiteSchema>
