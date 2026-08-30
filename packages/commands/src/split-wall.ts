import type { HouseDocument } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import type { Draft } from 'immer'
import { allocateId } from './allocate-id'

/**
 * Splits a wall at a point, returning the node now sitting there. The point must
 * already lie on the wall.
 *
 * The original wall keeps its id and becomes the first half, so anything that
 * referenced it still resolves. Openings will need their `t` remapped across the
 * split once they exist — there are none yet.
 */
export function splitWall(draft: Draft<HouseDocument>, wallId: string, at: Point): string {
  const wall = draft.walls[wallId]!

  // Landing on an existing corner needs no split, and making one would leave a
  // zero-length wall behind.
  for (const end of ['a', 'b'] as const) {
    const node = draft.nodes[wall[end]]!
    if (node.x === at.x && node.y === at.y) return node.id
  }

  const nodeId = allocateId(draft.nodes, 'n')
  draft.nodes[nodeId] = { id: nodeId, x: at.x, y: at.y }

  const secondId = allocateId(draft.walls, 'w')
  draft.walls[secondId] = { ...wall, id: secondId, a: nodeId, b: wall.b }
  wall.b = nodeId

  return nodeId
}
