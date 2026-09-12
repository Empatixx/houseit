import type { HouseDocument, Opening, Wall } from './document'

export type OpeningPart = Opening & { liningSide?: 'a' | 'b' }

export const pocketShift = (opening: Opening): number =>
  ((opening.slide ?? opening.hinge) === 'a' ? -1 : 1) * opening.width

// Inset is measured inward from the outer structural face, before facade layers.
export function frameOffset(opening: Opening, wall: Wall, outside?: -1 | 1): number {
  const frame = opening.frame
  return frame?.inset === undefined || outside === undefined
    ? 0
    : outside * (wall.thickness / 2 - frame.inset - frame.depth / 2)
}

export function doorLeafSize(opening: Opening) {
  const inset = opening.frame?.face ?? 0
  return {
    width: opening.width - 2 * inset,
    height: opening.height - inset,
    depth: opening.frame?.depth ?? 40,
    inset,
  }
}

export function openingParts(opening: Opening, span: number): OpeningPart[] {
  if (opening.leafWidth !== undefined) {
    const first = opening.hinge === 'a' ? opening.leafWidth : opening.width - opening.leafWidth
    return (
      [
        { width: first, x: 0, hinge: 'a' },
        { width: opening.width - first, x: first, hinge: 'b' },
      ] as const
    ).map((leaf) => ({
      ...opening,
      id: `${opening.id}-leaf-${leaf.hinge}`,
      t: opening.t + (leaf.x + leaf.width / 2 - opening.width / 2) / span,
      width: leaf.width,
      hinge: leaf.hinge,
      liningSide: leaf.hinge,
      leafWidth: undefined,
    }))
  }
  if (!opening.panels) return [opening]
  return opening.panels.map((p, i) => ({
    ...opening,
    id: `${opening.id}-panel-${i}`,
    kind: p.kind === 'door' ? 'door' : 'window',
    infill:
      p.kind === 'opaque' || p.glazing === 'none'
        ? 'opaque'
        : p.glazing === 'frosted'
          ? 'frosted'
          : 'glass',
    t: opening.t + (p.x + p.width / 2 - opening.width / 2) / span,
    width: p.width,
    height: p.height,
    sillHeight: opening.sillHeight + p.z,
    panels: undefined,
  }))
}
export function openingsIn(
  doc: HouseDocument,
  doors: 'leaves' | 'passages' = 'leaves',
): OpeningPart[] {
  return Object.values(doc.openings).flatMap((o) => {
    if (doors === 'passages' && o.kind === 'door') return [o]
    const wall = doc.walls[o.wall]
    const a = wall && doc.nodes[wall.a],
      b = wall && doc.nodes[wall.b]
    return a && b ? openingParts(o, Math.hypot(b.x - a.x, b.y - a.y)) : []
  })
}
