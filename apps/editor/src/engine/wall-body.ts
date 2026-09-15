import type { HouseDocument, Wall } from '@houseit/core/document'
import { soffitOf } from '@houseit/core/levels'
import { wallProfile } from '@houseit/geometry/wall-profile'

export type WallBody = {
  length: number
  thickness: number
  height: number
  sections: { base: number; height: number; profile: { x: number; z: number }[] }[]
  openings: { at: number; width: number; base: number; height: number }[]
}

export function wallBody(doc: HouseDocument, wall: Wall, plan = false): WallBody {
  const a = doc.nodes[wall.a]!,
    b = doc.nodes[wall.b]!
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  const ux = (b.x - a.x) / length,
    uy = (b.y - a.y) / length
  const height = Math.min(wall.height, soffitOf(doc.levels[wall.level]!) - wall.baseOffset)
  const heights = [
    ...new Set([
      0,
      height,
      ...Object.values(doc.walls)
        .filter(
          (w) =>
            w.level === wall.level &&
            (w.a === wall.a || w.b === wall.a || w.a === wall.b || w.b === wall.b),
        )
        .flatMap((w) => [
          w.baseOffset - wall.baseOffset,
          Math.min(w.baseOffset + w.height, soffitOf(doc.levels[w.level]!)) - wall.baseOffset,
        ])
        .filter((h) => h > 0 && h < height),
    ]),
  ].sort((a, b) => a - b)
  const sections = heights.slice(1).map((top, i) => ({
    base: heights[i]!,
    height: top - heights[i]!,
    profile: wallProfile(doc, wall, wall.baseOffset + (top + heights[i]!) / 2).map((p) => ({
      x: (p.x - a.x) * ux + (p.y - a.y) * uy,
      z: (p.x - a.x) * uy - (p.y - a.y) * ux,
    })),
  }))
  return {
    length,
    thickness: wall.thickness,
    height,
    sections,
    openings: Object.values(doc.openings)
      .filter((o) => o.wall === wall.id)
      .map((o) => ({
        at: o.t * length,
        width: o.width,
        base: plan ? 0 : o.sillHeight,
        height: plan ? height : o.height,
      })),
  }
}
