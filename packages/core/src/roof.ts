import { z } from 'zod'
import { FLOOR_MATERIAL_IDS } from './floor-materials'

const mm = z.number().int()
const point = z.object({ x: mm, y: mm })
export const RoofSchema = z
  .object({
    name: z.string().min(1),
    outline: z.array(point).min(3),
    finish: z.enum(['membrane', 'planted', 'gravel']),
    depth: mm.positive(),
    baseOffset: mm.default(0),
    material: z.enum(FLOOR_MATERIAL_IDS as [string, ...string[]]).optional(),
    colour: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
    facets: z
      .array(
        z.object({
          points: z.array(point.extend({ height: z.number().positive() })).length(3),
          material: z.enum(FLOOR_MATERIAL_IDS as [string, ...string[]]).optional(),
        }),
      )
      .optional(),
    parapet: z.object({
      height: mm.nonnegative(),
      thickness: mm.positive(),
      colour: z.string().regex(/^#[0-9a-f]{6}$/i),
      coping: mm.positive().default(20),
      edges: z
        .array(
          z.object({
            from: point,
            to: point,
            colour: z.string().regex(/^#[0-9a-f]{6}$/i),
          }),
        )
        .optional(),
    }),
    fall: z.object({
      percent: z.number().min(0).max(20),
      towards: z.enum(['north', 'south', 'east', 'west']),
    }),
    drains: z.array(point.extend({ diameter: mm.positive() })),
  })
  .superRefine((roof, ctx) => {
    const area = roof.outline.reduce((sum, a, i) => {
      const b = roof.outline[(i + 1) % roof.outline.length]!
      if (a.x !== b.x && a.y !== b.y)
        ctx.addIssue({ code: 'custom', message: 'roof edges must be orthogonal' })
      return sum + a.x * b.y - b.x * a.y
    }, 0)
    if (area === 0) ctx.addIssue({ code: 'custom', message: 'roof outline encloses no area' })
    for (const facet of roof.facets ?? []) {
      const [a, b, c] = facet.points
      if ((b!.x - a!.x) * (c!.y - a!.y) === (b!.y - a!.y) * (c!.x - a!.x))
        ctx.addIssue({ code: 'custom', message: 'roof facet must enclose an area' })
    }
  })

export type Roof = z.infer<typeof RoofSchema>
