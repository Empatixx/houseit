import { z } from 'zod'
import { FACADE_MATERIAL_IDS } from './facade-materials'

const colour = z.string().regex(/^#[0-9a-f]{6}$/i, 'use a #rrggbb colour')
const mm = z.number().int()

export const ExteriorSchema = z
  .object({
    layers: z
      .array(
        z.object({
          name: z.string().min(1),
          thickness: mm.positive(),
        }),
      )
      .min(1),
    colour,
    material: z.enum(FACADE_MATERIAL_IDS as [string, ...string[]]).optional(),
    base: mm.max(0).default(0),
    bands: z
      .array(
        z.object({
          from: mm,
          to: mm,
          colour,
          material: z.enum(FACADE_MATERIAL_IDS as [string, ...string[]]).optional(),
          along: z.object({ from: mm.nonnegative(), to: mm.positive() }).optional(),
        }),
      )
      .default([]),
  })
  .superRefine((exterior, ctx) => {
    for (const [i, band] of exterior.bands.entries()) {
      const along = band.along
      if (band.to <= band.from || band.from < exterior.base || (along && along.to <= along.from))
        ctx.addIssue({
          code: 'custom',
          message: 'façade bands must have positive extents within the coat',
        })
      for (const other of exterior.bands.slice(0, i)) {
        if (
          band.from < other.to &&
          other.from < band.to &&
          (along?.from ?? 0) < (other.along?.to ?? Infinity) &&
          (other.along?.from ?? 0) < (along?.to ?? Infinity)
        )
          ctx.addIssue({ code: 'custom', message: 'façade bands must not overlap' })
      }
    }
  })
export type Exterior = z.infer<typeof ExteriorSchema>
