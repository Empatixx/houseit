import type { HouseDocument } from '@houseit/core/document'
import { soffitOf } from '@houseit/core/levels'
import type { StairRun } from '@houseit/core/stair-flight'
import { treadsOf } from '@houseit/core/stairs'
import type { Point } from './outlines'
import { unionOfBoxes } from './union'

// Decompose orthogonal landing outlines before union; a landing may wrap a shaft.
function cells(outline: Point[]) {
  const xs = [...new Set(outline.map((p) => p.x))].sort((a, b) => a - b)
  const ys = [...new Set(outline.map((p) => p.y))].sort((a, b) => a - b)
  const cells = []
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < ys.length - 1; j++) {
      const x = (xs[i]! + xs[i + 1]!) / 2,
        y = (ys[j]! + ys[j + 1]!) / 2
      let inside = false
      for (let k = 0; k < outline.length; k++) {
        const p = outline[k]!,
          q = outline[(k + 1) % outline.length]!
        if (p.y > y !== q.y > y && x < ((q.x - p.x) * (y - p.y)) / (q.y - p.y) + p.x)
          inside = !inside
      }
      if (inside) cells.push({ x0: xs[i]!, x1: xs[i + 1]!, y0: ys[j]!, y1: ys[j + 1]! })
    }
  return cells
}
export function stairRise(doc: HouseDocument, level: string, stair: StairRun) {
  const base = doc.levels[level]!,
    top = doc.levels[stair.to]!
  return (
    (top.elevation - base.elevation - stair.baseOffset) /
    stair.flights.reduce((sum, flight) => sum + flight.risers, 0)
  )
}
export function runWells(doc: HouseDocument, level: string, ceiling = false) {
  const at = doc.levels[level]
  if (!at) return []
  return Object.values(doc.levels).flatMap((base) =>
    (base.stairs ?? []).flatMap((stair) => {
      if (ceiling ? base.id !== level : stair.to !== level) return []
      const top = doc.levels[stair.to]
      if (!top) return []
      const soffit = base.elevation + soffitOf(base)
      const riser = stairRise(doc, base.id, stair)
      const boxes = treadsOf(stair)
        .filter((t) => soffit - (base.elevation + stair.baseOffset + t.step * riser) < 2100)
        .flatMap((t) => cells(t.outline))
      return unionOfBoxes(boxes).map((outline) => ({ object: stair.id, type: 'stair', outline }))
    }),
  )
}
