import type { HouseDocument, Opening } from './document'

export function doorLeafSize(opening: Opening) {
  const inset = opening.frame?.face ?? 0
  return {
    width: opening.width - 2 * inset,
    height: opening.height - inset,
    depth: opening.frame?.depth ?? 40,
    inset,
  }
}

export function openingParts(opening: Opening, span: number): Opening[] {
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
export function openingsIn(doc: HouseDocument): Opening[] {
  return Object.values(doc.openings).flatMap((o) => {
    const wall = doc.walls[o.wall]
    const a = wall && doc.nodes[wall.a],
      b = wall && doc.nodes[wall.b]
    return a && b ? openingParts(o, Math.hypot(b.x - a.x, b.y - a.y)) : []
  })
}
