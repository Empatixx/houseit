import type { HouseDocument, Opening } from '@houseit/core/document'
import { exteriorSides } from '@houseit/geometry/exterior'
import { CommandError } from './command-error'

export function checkFrame(doc: HouseDocument, opening: Opening, what: string) {
  const frame = opening.frame
  if (frame?.inset === undefined) return
  const wall = doc.walls[opening.wall]!
  if (!exteriorSides(doc, wall.level).has(wall.id))
    throw new CommandError(`${what}: frame inset needs an exterior wall`)
  if (frame.inset + frame.depth > wall.thickness)
    throw new CommandError(`${what}: the frame does not fit inside the structural wall depth`)
}
