import { z } from 'zod'

const mm = z.number().int()
const id = z.string().min(1)

export const WallHostSchema = z.object({
  kind: z.literal('wall'),
  wall: id,
  t: z.number().min(0).max(1),
  z: mm,
  side: z.enum(['a', 'b']),
})

export const LevelHostSchema = z.object({
  kind: z.literal('level'),
  level: id,
  x: mm,
  y: mm,
  z: mm,
})

export const HostSchema = z.discriminatedUnion('kind', [WallHostSchema, LevelHostSchema])

export type WallHost = z.infer<typeof WallHostSchema>
export type LevelHost = z.infer<typeof LevelHostSchema>
export type Host = z.infer<typeof HostSchema>
