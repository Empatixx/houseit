import { z } from 'zod'

const mm = z.number().int()
export const ColumnSchema = z.object({
  id: z.string().min(1),
  x: mm,
  y: mm,
  width: mm.positive(),
  depth: mm.positive(),
  colour: z.string().regex(/^#[0-9a-f]{6}$/i),
})
export type Column = z.infer<typeof ColumnSchema>
