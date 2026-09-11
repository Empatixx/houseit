import { z } from 'zod'

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
    bands: z
      .array(
        z.object({
          from: mm.nonnegative(),
          to: mm.positive(),
          colour,
        }),
      )
      .default([]),
  })
  .superRefine((exterior, ctx) => {
    const bands = [...exterior.bands].sort((a, b) => a.from - b.from)
    for (const [i, band] of bands.entries()) {
      if (band.to <= band.from || (i > 0 && band.from < bands[i - 1]!.to)) {
        ctx.addIssue({
          code: 'custom',
          message: 'façade bands must have positive height and must not overlap',
        })
      }
    }
  })
