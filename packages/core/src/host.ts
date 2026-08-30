import { z } from 'zod'

const mm = z.number().int()
const id = z.string().min(1)

/**
 * Anything placed in the building is anchored to a host, never to absolute
 * coordinates. Move the host and the thing moves with it — which is what keeps a
 * socket on its wall after the disposition changes.
 */
export const WallHostSchema = z.object({
  kind: z.literal('wall'),
  wall: id,
  /** Position along the wall, 0 at end `a` and 1 at end `b`. */
  t: z.number().min(0).max(1),
  /** Height above the level's floor. */
  z: mm,
  side: z.enum(['a', 'b']),
})

/**
 * Rooms are derived faces and therefore have no stable identity, so they cannot
 * host anything. Ceiling fixtures and free-standing items anchor to the level.
 */
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
