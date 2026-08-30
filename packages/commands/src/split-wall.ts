import type { HouseDocument } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import type { Draft } from 'immer'
import { allocateId } from './allocate-id'
import { CommandError } from './command-error'

/**
 * Splits a wall at a point, returning the node now sitting there. The point must
 * already lie on the wall.
 *
 * The original wall keeps its id and becomes the first half, so anything that
 * referenced it still resolves. What does not survive by itself are the openings:
 * `t` is a fraction of the wall, so a window left alone across a split stays at
 * the same fraction of a shorter wall and slides — and, since the wall is now
 * shorter than the window, ends up wider than the thing it is cut into. So they
 * are moved here, onto whichever half they landed in, at the fraction that puts
 * them back where they were.
 *
 * A window the split runs straight through cannot be moved anywhere. That is a
 * partition through a window, and the honest answer is to refuse it.
 */
export function splitWall(draft: Draft<HouseDocument>, wallId: string, at: Point): string {
  const wall = draft.walls[wallId]!

  // Landing on an existing corner needs no split, and making one would leave a
  // zero-length wall behind.
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
