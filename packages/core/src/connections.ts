import { z } from 'zod'

const mm = z.number().int()
const point = { x: mm, y: mm }
export const ShaftSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['lift', 'services']).default('lift'),
  to: z.string().min(1),
  ...point,
  width: mm.positive(),
  depth: mm.positive(),
  enclosure: z
    .object({
      thickness: mm.positive(),
      doorSide: z.enum(['north', 'south', 'east', 'west']).optional(),
      doorWidth: mm.positive().optional(),
      doorHeight: mm.positive().optional(),
      colour: z.string().regex(/^#[0-9a-f]{6}$/i),
    })
    .refine(
      (e) =>
        [e.doorSide, e.doorWidth, e.doorHeight].every((v) => v === undefined) ||
        [e.doorSide, e.doorWidth, e.doorHeight].every((v) => v !== undefined),
      'enclosure door needs side, width and height together',
    )
    .optional(),
})
export const RampSchema = z
  .object({
    id: z.string().min(1),
    to: z.string().min(1).optional(),
    toElevation: mm.optional(),
    baseOffset: mm.default(0),
    ...point,
    width: mm.positive(),
    length: mm.positive(),
    direction: z.enum(['north', 'south', 'east', 'west']),
    thickness: mm.positive(),
    colour: z.string().regex(/^#[0-9a-f]{6}$/i),
  })
  .refine(
    (r) => (r.to === undefined) !== (r.toElevation === undefined),
    'a ramp needs exactly one destination: to or toElevation',
  )
export type Shaft = z.infer<typeof ShaftSchema>
export type Ramp = z.infer<typeof RampSchema>
