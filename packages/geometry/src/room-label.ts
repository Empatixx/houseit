import type { HouseDocument } from '@houseit/core/document'
import { openingsIn } from '@houseit/core/opening-parts'
import { treadsOf } from '@houseit/core/stairs'
import { areaInBox } from './area-in-box'
import { wallBox } from './boxes'
import { clearOutline } from './clear'
import { shaftOutside, shaftsOn } from './connections'
import type { Point } from './outlines'
import { containsPoint, type Room } from './rooms'
import { swingOf } from './swing'
import { wellsIn } from './wells'

export function roomLabel(doc: HouseDocument, level: string, room: Room) {
  const outline = clearOutline(doc, level, room.nodes)
  const excluded = shaftsOn(doc, level)
    .filter((s) => s.enclosure)
    .map(shaftOutside)
  excluded.push(
    ...(doc.levels[level]?.stairs ?? []).flatMap((s) => treadsOf(s).map((t) => t.outline)),
    ...wellsIn(doc, level).map((well) => well.outline),
  )
  for (const opening of openingsIn(doc)) {
    const wall = doc.walls[opening.wall]!
    if (wall.level !== level) continue
    const box = swingOf(doc, opening)
    if (!box) continue
    // The drawn leaf starts at the wall face; leave room for its outline too.
    const margin = wall.thickness / 2 + 40
    excluded.push([
      { x: box.x0 - margin, y: box.y0 - margin },
      { x: box.x1 + margin, y: box.y0 - margin },
      { x: box.x1 + margin, y: box.y1 + margin },
      { x: box.x0 - margin, y: box.y1 + margin },
    ])
  }
  for (const id of room.partitions) {
    const wall = doc.walls[id]!
    const box = wallBox(doc.nodes[wall.a]!, doc.nodes[wall.b]!, wall.thickness)
    excluded.push([
      { x: box.x0, y: box.y0 },
      { x: box.x1, y: box.y0 },
      { x: box.x1, y: box.y1 },
      { x: box.x0, y: box.y1 },
    ])
  }
  const loops = [outline, ...excluded]
  const x0 = Math.min(...outline.map((p) => p.x)),
    x1 = Math.max(...outline.map((p) => p.x))
  const y0 = Math.min(...outline.map((p) => p.y)),
    y1 = Math.max(...outline.map((p) => p.y))
  const points = loops.flat()
  const xs = [...new Set(points.map((p) => p.x).filter((x) => x >= x0 && x <= x1))].sort(
    (a, b) => a - b,
  )
  const ys = [...new Set(points.map((p) => p.y).filter((y) => y >= y0 && y <= y1))].sort(
    (a, b) => a - b,
  )
  const free = (p: Point) =>
    containsPoint(outline, p.x, p.y) && !excluded.some((hole) => containsPoint(hole, p.x, p.y))
  const space = (p: Point) => {
    let left = x0,
      right = x1,
      down = y0,
      up = y1
    for (const loop of loops)
      for (let i = 0; i < loop.length; i++) {
        const a = loop[i]!,
          b = loop[(i + 1) % loop.length]!
        if (a.x === b.x && Math.min(a.y, b.y) < p.y && p.y < Math.max(a.y, b.y)) {
          if (a.x < p.x) left = Math.max(left, a.x)
          else right = Math.min(right, a.x)
        }
        if (a.y === b.y && Math.min(a.x, b.x) < p.x && p.x < Math.max(a.x, b.x)) {
          if (a.y < p.y) down = Math.max(down, a.y)
          else up = Math.min(up, a.y)
        }
      }
    return {
      x: p.x,
      y: p.y,
      width: 2 * Math.min(p.x - left, right - p.x),
      height: 2 * Math.min(p.y - down, up - p.y),
    }
  }
  let best = { ...room.centre, width: 0, height: 0 }
  let score = -1
  const consider = (p: Point) => {
    if (!free(p)) return
    const candidate = space(p)
    candidate.height = Math.min(candidate.height, candidate.width / 2)
    const value = candidate.width * candidate.height
    if (value > score) {
      const box = {
        x0: p.x - candidate.width / 2,
        x1: p.x + candidate.width / 2,
        y0: p.y - candidate.height / 2,
        y1: p.y + candidate.height / 2,
      }
      if (
        areaInBox(outline, box) < candidate.width * candidate.height - 0.01 ||
        excluded.some((hole) => areaInBox(hole, box) > 0.01)
      )
        return
      best = candidate
      score = value
    }
  }
  consider(room.centre)
  // An obstacle in one row need not split the clear width of another row.
  for (let j = 0; j < ys.length - 1; j++)
    consider({ x: (x0 + x1) / 2, y: (ys[j]! + ys[j + 1]!) / 2 })
  for (let i = 0; i < xs.length - 1; i++)
    consider({ x: (xs[i]! + xs[i + 1]!) / 2, y: (y0 + y1) / 2 })
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < ys.length - 1; j++)
      consider({ x: (xs[i]! + xs[i + 1]!) / 2, y: (ys[j]! + ys[j + 1]!) / 2 })
  return best
}
