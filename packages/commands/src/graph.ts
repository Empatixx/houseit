import type { HouseDocument, Wall } from '@houseit/core/document'
import type { Draft } from 'immer'

/**
 * Small truths about the wall graph that more than one command needs: which
 * walls meet at a node, whether two walls run on in a straight line, and how
 * to take a wall out without leaving a node or an opening behind.
 */

export function wallsAt(
  doc: HouseDocument | Draft<HouseDocument>,
  level: string,
  node: string,
): Wall[] {
  return Object.values(doc.walls).filter(
    (wall) => wall.level === level && (wall.a === node || wall.b === node),
  ) as Wall[]
}

/** Whether two walls sharing a node lie on one line, so a node between them is nothing. */
export function collinear(
  doc: HouseDocument | Draft<HouseDocument>,
  one: Wall,
  other: Wall,
): boolean {
  const a = doc.nodes[one.a]
  const b = doc.nodes[one.b]
  const c = doc.nodes[other.a]
  const d = doc.nodes[other.b]
  if (!a || !b || !c || !d) return false
  const cross = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x)
  return Math.abs(cross) < 1e-6
}

/** Takes a wall out with everything in it, and the ends it leaves unattached. */
export function deleteWall(draft: Draft<HouseDocument>, level: string, wallId: string): void {
  const wall = draft.walls[wallId]
  if (!wall) return
  for (const opening of Object.values(draft.openings)) {
    if (opening.wall === wallId) delete draft.openings[opening.id]
  }
  delete draft.walls[wallId]
  for (const node of [wall.a, wall.b]) {
    if (wallsAt(draft, level, node).length === 0) delete draft.nodes[node]
  }
}

/**
 * Straightens a node that two walls of one line meet at, into one wall. The
 * openings of both keep their places along the joined wall. Nothing happens
 * where a third wall meets, or where the two are not in line.
 */
export function straighten(draft: Draft<HouseDocument>, level: string, node: string): void {
  const [one, other, third] = wallsAt(draft, level, node)
  if (!one || !other || third || one.thickness !== other.thickness) return
  if (!collinear(draft, one, other)) return

  const farOfOne = one.a === node ? one.b : one.a
  const farOfOther = other.a === node ? other.b : other.a
  const p = draft.nodes[farOfOne]
  const q = draft.nodes[farOfOther]
  const m = draft.nodes[node]
  if (!p || !q || !m) return
  const length = Math.hypot(q.x - p.x, q.y - p.y)
  if (length === 0) return

  // Every opening of both, as a distance from the far end of the first.
  const distance = (wall: Wall, t: number) => {
    const a = draft.nodes[wall.a]!
    const b = draft.nodes[wall.b]!
    const at = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    return Math.hypot(at.x - p.x, at.y - p.y)
  }
  for (const opening of Object.values(draft.openings)) {
    if (opening.wall === one.id) opening.t = distance(one, opening.t) / length
    if (opening.wall === other.id) {
      opening.t = distance(other, opening.t) / length
      opening.wall = one.id
    }
  }
  one.a = farOfOne
  one.b = farOfOther
  delete draft.walls[other.id]
  delete draft.nodes[node]
}
