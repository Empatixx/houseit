import type { HouseDocument } from '@houseit/core/document'
import { wallHosts } from '@houseit/core/wall-hosts'
import { elementId, wallElement } from '@houseit/geometry/wall-elements'
import { CommandError } from './command-error'
import { connectCrossings } from './wall-junctions'

export function resizeWallEnd(doc: HouseDocument, id: string, length: number, end: 'from' | 'to') {
  const old = wallElement(doc, id)
  const tip = old[end]
  if (
    Object.values(doc.walls).some(
      (w) => elementId(w) !== old.id && (w.a === tip.id || w.b === tip.id),
    )
  )
    throw new CommandError('update-wall: length can only move a free endpoint')
  const anchors = [
    ...Object.values(doc.openings),
    ...wallHosts(doc).map(({ host }) => host),
  ].flatMap((host) => {
    const part = old.segments.find((s) => s.wall.id === host.wall)
    return part
      ? [
          {
            host,
            at: part.from + (part.to - part.from) * host.t,
            width: 'width' in host ? host.width : 0,
          },
        ]
      : []
  })
  const fixed = old[end === 'to' ? 'from' : 'to']
  const direction = end === 'to' ? 1 : -1
  tip.x = Math.round(fixed.x + direction * old.unit.x * length)
  tip.y = Math.round(fixed.y + direction * old.unit.y * length)
  const next = wallElement(doc, id)
  for (const { host, at: before, width } of anchors) {
    const at = end === 'to' ? before : next.length - (old.length - before)
    const part = next.segments.find((s) => at - width / 2 >= s.from && at + width / 2 <= s.to)
    if (!part)
      throw new CommandError('update-wall: a hosted opening or device no longer fits the wall')
    host.wall = part.wall.id
    host.t = (at - part.from) / (part.to - part.from)
  }
  return [old.id, ...connectCrossings(doc, old.level)]
}
