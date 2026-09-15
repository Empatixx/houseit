import type { HouseDocument, Wall } from '@houseit/core/document'
import { wallHosts } from '@houseit/core/wall-hosts'
import type { Draft } from 'immer'
import { CommandError } from './command-error'

export function wallsAt(
  doc: HouseDocument | Draft<HouseDocument>,
  level: string,
  node: string,
): Wall[] {
  return Object.values(doc.walls).filter(
    (wall) => wall.level === level && (wall.a === node || wall.b === node),
  ) as Wall[]
}

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

export function deleteWall(draft: Draft<HouseDocument>, level: string, wallId: string): void {
  const wall = draft.walls[wallId]
  if (!wall) return
  if (wallHosts(draft).some(({ host }) => host.wall === wallId))
    throw new CommandError(`Wall ${wallId} still has electrical hosts`)
  for (const opening of Object.values(draft.openings)) {
    if (opening.wall === wallId) delete draft.openings[opening.id]
  }
  delete draft.walls[wallId]
  for (const node of [wall.a, wall.b]) {
    if (wallsAt(draft, level, node).length === 0) delete draft.nodes[node]
  }
}

export function straighten(draft: Draft<HouseDocument>, level: string, node: string): void {
  const [one, other, third] = wallsAt(draft, level, node)
  if (!one || !other || third || one.thickness !== other.thickness) return
  if (one.element !== other.element) return
  if (one.element && one.a === node) return
  if (one.height !== other.height || one.baseOffset !== other.baseOffset) return
  if (!collinear(draft, one, other)) return

  const farOfOne = one.a === node ? one.b : one.a
  const farOfOther = other.a === node ? other.b : other.a
  const p = draft.nodes[farOfOne]
  const q = draft.nodes[farOfOther]
  const m = draft.nodes[node]
  if (!p || !q || !m) return
  const length = Math.hypot(q.x - p.x, q.y - p.y)
  if (length === 0) return

  const distance = (wall: Wall, t: number) => {
    const a = draft.nodes[wall.a]!
    const b = draft.nodes[wall.b]!
    const at = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    return Math.hypot(at.x - p.x, at.y - p.y)
  }
  for (const opening of [
    ...Object.values(draft.openings),
    ...wallHosts(draft).map((h) => h.host),
  ]) {
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
