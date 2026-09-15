import type { HouseDocument } from '@houseit/core/document'
import { anchorInside } from '@houseit/geometry/anchor'
import { containsPoint, roomsOf } from '@houseit/geometry/rooms'
import type { Draft } from 'immer'
import { z } from 'zod'
import { allocateId } from '../allocate-id'
import { CommandError } from '../command-error'
import { linkPoints } from '../partition'

export const BoundarySchema = z
  .array(
    z.object({ x: z.number().int(), y: z.number().int(), thickness: z.number().int().positive() }),
  )
  .min(3)

export function roomByBoundary(
  draft: Draft<HouseDocument>,
  level: string,
  args: { name: string; material: string; boundary: z.infer<typeof BoundarySchema> },
): string[] {
  const boundary = args.boundary
  const before = roomsOf(draft, level).filter((r) => r.id)
  if (before.some((r) => r.name === args.name))
    throw new CommandError(`add-room: there is already a room called ${args.name}`)
  const signed =
    boundary.reduce((sum, a, i) => {
      const b = boundary[(i + 1) % boundary.length]!
      return sum + a.x * b.y - b.x * a.y
    }, 0) / 2
  if (Math.abs(signed) < 1) throw new CommandError('add-room: boundary encloses no area')
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i]!,
      b = boundary[(i + 1) % boundary.length]!
    if (a.x === b.x && a.y === b.y)
      throw new CommandError('add-room: boundary has a zero-length edge')
    if (a.x !== b.x && a.y !== b.y)
      throw new CommandError('add-room: measured boundaries must be orthogonal')
    try {
      linkPoints(draft, level, a, b, a.thickness, 'add-room')
    } catch (error) {
      if (
        !(error instanceof CommandError) ||
        !error.message.endsWith('there is a wall there already')
      )
        throw error
    }
    for (const wall of Object.values(draft.walls).filter((w) => w.level === level)) {
      const p = draft.nodes[wall.a]!,
        q = draft.nodes[wall.b]!
      const x = (p.x + q.x) / 2,
        y = (p.y + q.y) / 2
      const on =
        a.x === b.x
          ? p.x === q.x && x === a.x && y > Math.min(a.y, b.y) && y < Math.max(a.y, b.y)
          : p.y === q.y && y === a.y && x > Math.min(a.x, b.x) && x < Math.max(a.x, b.x)
      if (on && wall.thickness !== a.thickness)
        throw new CommandError(
          `add-room: shared wall ${wall.id} is ${wall.thickness} mm, boundary says ${a.thickness}`,
        )
    }
  }
  const after = roomsOf(draft, level)
  for (const old of before) {
    const current = after.find((r) => r.id === old.id)
    if (!current || Math.abs(current.area - old.area) > 1)
      throw new CommandError(`add-room: boundary would split or overlap ${old.name}`)
  }
  const matches = after.filter((r) => {
    if (r.id) return false
    const anchor = anchorInside(
      r.nodes.map((id) => draft.nodes[id]!),
      r.area,
    )
    return containsPoint(boundary, anchor.x, anchor.y)
  })
  if (matches.length !== 1 || Math.abs(matches[0]!.area - Math.abs(signed)) > 1)
    throw new CommandError(
      'add-room: measured boundary must enclose exactly one room; check crossings and duplicate outlines',
    )
  const face = matches[0]!
  const anchor = anchorInside(
    face.nodes.map((id) => draft.nodes[id]!),
    face.area,
  )
  const id = allocateId(draft.rooms, 'r')
  draft.rooms[id] = {
    id,
    level,
    name: args.name,
    floor: args.material,
    ...anchor,
    loop: [...face.walls],
  }
  return [id]
}
