import type { HouseDocument } from '@houseit/core/document'
import { layerOf } from '@houseit/core/object-types'
import { openingsIn } from '@houseit/core/opening-parts'
import { areaInBox } from '@houseit/geometry/area-in-box'
import { boxOf, clashes, wallBox } from '@houseit/geometry/boxes'
import { clearOutline } from '@houseit/geometry/clear'
import { shaftOutside, shaftsOn } from '@houseit/geometry/connections'
import type { Room } from '@houseit/geometry/rooms'
import { piecesOf, standingAt } from '@houseit/geometry/standing'
import { swingOf } from '@houseit/geometry/swing'
import type { Draft } from 'immer'
import type { z } from 'zod'
import { CommandError } from './command-error'
import { ReturnSchema } from './room-return'
import { addWall } from './wall'

export const PartitionSchema = ReturnSchema.extend({ points: ReturnSchema.shape.points.length(2) })

export function roomPartition(
  draft: Draft<HouseDocument>,
  level: string,
  room: Room,
  value: z.infer<typeof PartitionSchema>,
) {
  const fail = (why: string): never => {
    throw new CommandError(`update-room --partition: ${why}`)
  }
  const [a, b] = value.points
  if ((a!.x === b!.x) === (a!.y === b!.y)) fail('use one nonzero orthogonal run')
  if (value.height > (draft.levels[level]!.clearHeight ?? draft.levels[level]!.height))
    fail('partition reaches above the soffit')
  const box = wallBox(a!, b!, value.thickness)
  const clear = clearOutline(draft, level, room.nodes)
  const margin = { x0: box.x0 - 0.5, x1: box.x1 + 0.5, y0: box.y0 - 0.5, y1: box.y1 + 0.5 }
  if (Math.abs(areaInBox(clear, margin) - (margin.x1 - margin.x0) * (margin.y1 - margin.y0)) > 0.01)
    fail('the whole partition, with both ends free, must lie inside clear floor')
  for (const wall of Object.values(draft.walls)) {
    if (wall.level !== level) continue
    if (clashes(margin, wallBox(draft.nodes[wall.a]!, draft.nodes[wall.b]!, wall.thickness), 0))
      fail(`it meets wall ${wall.id}; use --return for a wall attached at one end`)
  }
  for (const c of draft.levels[level]!.columns ?? []) {
    if (
      clashes(
        box,
        {
          x0: c.x - c.width / 2,
          x1: c.x + c.width / 2,
          y0: c.y - c.depth / 2,
          y1: c.y + c.depth / 2,
        },
        0,
      )
    )
      fail(`it overlaps column ${c.id}`)
  }
  for (const shaft of shaftsOn(draft, level))
    if (clashes(box, boxOf(shaftOutside(shaft)), 0)) fail(`it overlaps shaft ${shaft.id}`)
  for (const object of Object.values(draft.objects)) {
    if (object.level !== level || object.room !== room.id || layerOf(object.type) !== 'floor')
      continue
    const at = standingAt(draft, level, room, object)
    if (at && piecesOf(at, object).some((p) => clashes(box, boxOf(p), 0)))
      fail(`it overlaps object ${object.id}`)
  }
  for (const opening of openingsIn(draft)) {
    if (draft.walls[opening.wall]?.level !== level) continue
    const swing = swingOf(draft, opening)
    if (swing && clashes(box, swing, 0)) fail(`it blocks door ${opening.id}`)
  }
  addWall.apply(draft, {
    from: a!,
    to: b!,
    thickness: value.thickness,
    height: value.height,
    level,
  })
}
