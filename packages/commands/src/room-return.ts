import type { HouseDocument } from '@houseit/core/document'
import { containsPoint, type Room, roomsOf } from '@houseit/geometry/rooms'
import type { Draft } from 'immer'
import { z } from 'zod'
import { CommandError } from './command-error'
import { wallUnder } from './partition'
import { addWall } from './wall'

const mm = z.number().int()
export const ReturnSchema = z.object({
  points: z.array(z.object({ x: mm, y: mm })).min(2),
  thickness: mm.positive(),
  height: mm.positive(),
})

export function roomReturn(
  draft: Draft<HouseDocument>,
  level: string,
  room: Room,
  value: z.infer<typeof ReturnSchema>,
) {
  const fail = (why: string): never => {
    throw new CommandError(`update-room --return: ${why}`)
  }
  const polygon = room.nodes.map((id) => draft.nodes[id]!)
  const start = value.points[0]!
  const host = wallUnder(draft, level, start)
  if (!host || !room.walls.includes(host.id)) fail('start on this room’s wall centre line')
  if (value.height > (draft.levels[level]!.clearHeight ?? draft.levels[level]!.height))
    fail('return reaches above the soffit')
  const count = roomsOf(draft, level).length
  for (let i = 1; i < value.points.length; i++) {
    const a = value.points[i - 1]!,
      b = value.points[i]!
    if ((a.x === b.x) === (a.y === b.y)) fail('use nonzero orthogonal legs')
    const span = Math.hypot(b.x - a.x, b.y - a.y)
    for (let n = 1, steps = Math.ceil(span / 25); n <= steps; n++) {
      const t = n / steps
      if (!containsPoint(polygon, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t))
        fail('the return must end inside this room')
    }
    addWall.apply(draft, {
      from: a,
      to: b,
      thickness: value.thickness,
      height: value.height,
      level,
    })
  }
  if (roomsOf(draft, level).length !== count) fail('a return must not enclose another room')
}
