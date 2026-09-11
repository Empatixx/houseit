import { z } from 'zod'

const mm = z.number().int()
const point = { x: mm, y: mm }
export const ShaftSchema = z.object({
  id: z.string().min(1),
  to: z.string().min(1),
  ...point,
  width: mm.positive(),
  depth: mm.positive(),
  enclosure: z
    .object({
      thickness: mm.positive(),
      doorSide: z.enum(['north', 'south', 'east', 'west']),
      doorWidth: mm.positive(),
      doorHeight: mm.positive(),
      colour: z.string().regex(/^#[0-9a-f]{6}$/i),
    })
    .optional(),
})
export const RampSchema = z.object({
  id: z.string().min(1),
  to: z.string().min(1),
  ...point,
  width: mm.positive(),
  length: mm.positive(),
  direction: z.enum(['north', 'south', 'east', 'west']),
  thickness: mm.positive(),
  colour: z.string().regex(/^#[0-9a-f]{6}$/i),
})
export type Shaft = z.infer<typeof ShaftSchema>
export type Ramp = z.infer<typeof RampSchema>
