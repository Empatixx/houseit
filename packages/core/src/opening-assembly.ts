import { z } from 'zod'

const mm = z.number().int()
export const FrameSchema = z.object({
  depth: mm.positive(),
  face: mm.positive(),
  outside: z.string().regex(/^#[0-9a-f]{6}$/i),
  inside: z.string().regex(/^#[0-9a-f]{6}$/i),
})
export const PanelSchema = z.object({
  kind: z.enum(['fixed', 'casement', 'tilt-turn', 'opaque', 'door']),
  glazing: z.enum(['clear', 'frosted']).optional(),
  x: mm.nonnegative(),
  z: mm.nonnegative(),
  width: mm.positive(),
  height: mm.positive(),
})
export const PanelsSchema = z.array(PanelSchema).min(1)
