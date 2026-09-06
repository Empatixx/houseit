import type { HouseDocument } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import type { Draft } from 'immer'
import { allocateId } from './allocate-id'
import { CommandError } from './command-error'

export function splitWall(draft: Draft<HouseDocument>, wallId: string, at: Point): string {
  const wall = draft.walls[wallId]!

  for (const end of ['a', 'b'] as const) {
    const node = draft.nodes[wall[end]]!
    if (node.x === at.x && node.y === at.y) return node.id
  }

  const a = draft.nodes[wall.a]!
  const b = draft.nodes[wall.b]!
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  const here = Math.hypot(at.x - a.x, at.y - a.y)

  const nodeId = allocateId(draft.nodes, 'n')
  draft.nodes[nodeId] = { id: nodeId, x: at.x, y: at.y }

  const secondId = allocateId(draft.walls, 'w')
  draft.walls[secondId] = { ...wall, id: secondId, a: nodeId, b: wall.b }
  wall.b = nodeId

  for (const opening of Object.values(draft.openings)) {
    if (opening.wall !== wallId) continue

    const middle = opening.t * length
    if (Math.abs(middle - here) < opening.width / 2) {
      throw new CommandError(`that partition would run through a ${opening.kind}`)
    }

    if (middle < here) opening.t = middle / here
    else {
      opening.wall = secondId
      opening.t = (middle - here) / (length - here)
    }
  }

  return nodeId
}
