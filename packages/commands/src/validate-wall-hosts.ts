import type { HouseDocument } from '@houseit/core/document'
import { soffitOf } from '@houseit/core/levels'
import { wallHosts } from '@houseit/core/wall-hosts'
import { elementId } from '@houseit/geometry/wall-elements'
import { CommandError } from './command-error'

export function validateWallHosts(doc: HouseDocument, level: string) {
  for (const { id, host } of wallHosts(doc)) {
    const wall = doc.walls[host.wall]
    if (!wall) throw new CommandError(`Wall host ${id} references a missing wall`)
    if (wall.level !== level) continue
    if (
      host.t < 0 ||
      host.t > 1 ||
      host.z < 0 ||
      host.z > Math.min(wall.height, soffitOf(doc.levels[level]!) - wall.baseOffset)
    )
      throw new CommandError(`Wall host ${id} no longer fits wall ${elementId(wall)}`)
    const a = doc.nodes[wall.a]!,
      b = doc.nodes[wall.b]!
    const span = Math.hypot(b.x - a.x, b.y - a.y)
    if (
      Object.values(doc.openings).some(
        (o) =>
          o.wall === wall.id &&
          Math.abs(o.t - host.t) * span < o.width / 2 &&
          host.z > o.sillHeight &&
          host.z < o.sillHeight + o.height,
      )
    )
      throw new CommandError(`Wall host ${id} would be inside an opening`)
  }
}
