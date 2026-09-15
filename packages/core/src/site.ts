import { z } from 'zod'
import { FLOOR_MATERIAL_IDS } from './floor-materials'

const mm = z.number().int()
const point = z.object({ x: mm, y: mm })
const colour = z.string().regex(/^#[0-9a-f]{6}$/i)
const named = { id: z.string().min(1), name: z.string().min(1) }

export const SiteSurfaceSchema = z
  .object({
    ...named,
    outline: z.array(point).min(3),
    elevation: mm,
    slope: z.object({ x: z.number(), y: z.number() }),
    depth: mm.positive(),
    kind: z.enum(['paving', 'asphalt', 'grass', 'gravel']),
    colour,
    material: z.enum(FLOOR_MATERIAL_IDS as [string, ...string[]]).optional(),
  })
  .superRefine((s, ctx) => {
    const area = s.outline.reduce((sum, p, i) => {
      const q = s.outline[(i + 1) % s.outline.length]!
      return sum + p.x * q.y - q.x * p.y
    }, 0)
    if (!area) ctx.addIssue({ code: 'custom', message: 'surface must enclose an area' })
  })

export const SiteLineSchema = z.object({
  ...named,
  surface: z.string().min(1),
  points: z.array(point).min(2),
  width: mm.positive(),
  colour,
})

export const SiteRailSchema = z.object({
  ...named,
  points: z.array(point.extend({ z: mm })).min(2),
  height: mm.positive(),
  postSize: mm.positive(),
  spacing: mm.positive(),
  barSize: mm.positive(),
  barSpacing: mm.positive(),
  colour,
  infill: z.enum(['bars', 'glass', 'none']).default('bars'),
  rails: z.array(mm.nonnegative()).optional(),
  round: z.boolean().default(false),
})

export const SiteSchema = z
  .object({
    groundCutout: z
      .object({ x0: mm, x1: mm, y0: mm, y1: mm })
      .refine((b) => b.x1 > b.x0 && b.y1 > b.y0, 'ground cutout must have positive extents'),
    surfaces: z.array(SiteSurfaceSchema),
    markings: z.array(SiteLineSchema),
    railings: z.array(SiteRailSchema),
  })
  .superRefine((site, ctx) => {
    const ids = [...site.surfaces, ...site.markings, ...site.railings].map((s) => s.id)
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: 'custom', message: 'site ids must be unique' })
    for (const line of site.markings)
      if (!site.surfaces.some((s) => s.id === line.surface))
        ctx.addIssue({
          code: 'custom',
          message: `marking ${line.id} has no surface ${line.surface}`,
        })
  })

export type Site = z.infer<typeof SiteSchema>
export type SiteSurface = z.infer<typeof SiteSurfaceSchema>
export const siteHeight = (s: SiteSurface, x: number, y: number) =>
  s.elevation + (x - s.outline[0]!.x) * s.slope.x + (y - s.outline[0]!.y) * s.slope.y
