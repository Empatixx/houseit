import type { HouseDocument } from '@houseit/core/document'
import { findFaces } from '@houseit/core/faces'
import { areaPaths, EndType, inflatePaths, JoinType } from 'clipper2-ts'
import { clearOutline } from './clear'

export const NARROWEST = 600
const LOST = 50_000

export type NarrowPart = { nodes: string[]; room?: string; lost: number }

export function narrowParts(doc: HouseDocument, level: string): NarrowPart[] {
  const named = new Map(
    Object.values(doc.rooms)
      .filter((room) => room.level === level)
      .map((room) => [[...room.loop].sort().join(','), room.name] as const),
  )
  const found: NarrowPart[] = []
  for (const face of findFaces(doc, level)) {
    const outline = clearOutline(doc, level, face.nodes)
    if (outline.length < 3) continue
    const clear = [outline.map((point) => ({ x: Math.round(point.x), y: Math.round(point.y) }))]
    const whole = Math.abs(areaPaths(clear))
    if (whole === 0) continue
    const eroded = inflatePaths(clear, -NARROWEST / 2, JoinType.Miter, EndType.Polygon)
    const opened = inflatePaths(eroded, NARROWEST / 2, JoinType.Miter, EndType.Polygon)
    const lost = whole - Math.abs(areaPaths(opened))
    if (lost <= LOST) continue
    const room = named.get([...face.walls].sort().join(','))
    found.push({ nodes: face.nodes, ...(room ? { room } : {}), lost })
  }
  return found
}
