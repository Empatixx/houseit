import type { HouseDocument } from '@houseit/core/document'
import { wallHosts } from '@houseit/core/wall-hosts'
import type { Point } from '@houseit/geometry/outlines'
import type { Draft } from 'immer'
import { allocateId } from './allocate-id'
import { CommandError } from './command-error'

export function splitWall(
  draft: Draft<HouseDocument>,
  wallId: string,
  at: Point,
  existingNode?: string,
): string {
  const wall = draft.walls[wallId]!

  for (const end of ['a', 'b'] as const) {
    const node = draft.nodes[wall[end]]!
    if (node.x === at.x && node.y === at.y) return node.id
  }

  const a = draft.nodes[wall.a]!
  const b = draft.nodes[wall.b]!
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  const here = Math.hypot(at.x - a.x, at.y - a.y)

  const nodeId = existingNode ?? allocateId(draft.nodes, 'n')
  if (
    existingNode &&
    (!draft.nodes[existingNode] ||
      draft.nodes[existingNode]!.x !== at.x ||
      draft.nodes[existingNode]!.y !== at.y)
  )
    throw new CommandError('split-wall: the shared node must match the junction')
  draft.nodes[nodeId] ??= { id: nodeId, x: at.x, y: at.y }

  wall.element ??= wall.id
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

  for (const { host } of wallHosts(draft)) {
    if (host.wall !== wallId) continue
    const middle = host.t * length
    if (middle < here) host.t = middle / here
    else {
      host.wall = secondId
      host.t = (middle - here) / (length - here)
    }
  }

  return nodeId
}
