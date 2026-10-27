import type { HouseDocument, Opening } from '@houseit/core/document'
import { soffitOf } from '@houseit/core/levels'
import { elementId } from '@houseit/geometry/wall-elements'
import { wallProfile } from '@houseit/geometry/wall-profile'
import { isDraft, original } from 'immer'
import { CommandError } from './command-error'
import { checkFrame } from './opening-frame'
import { checkPockets } from './pocket-door'
import { validateWallHosts } from './validate-wall-hosts'

export function validateWalls(doc: HouseDocument, level: string) {
  const faults = wallFaults(doc, level)
  if (faults.length === 0) return
  const before = isDraft(doc) ? original(doc) : undefined
  const known = new Set(before ? wallFaults(before, level) : [])
  const fresh = faults.find((fault) => !known.has(fault))
  if (fresh) throw new CommandError(fresh)
}

export function openingReach(
  doc: HouseDocument,
  opening: Pick<Opening, 'sillHeight' | 'height'>,
  wall: { height: number; baseOffset: number; level: string },
): { reach: number; top: number } | undefined {
  const top = Math.min(wall.height, soffitOf(doc.levels[wall.level]!) - wall.baseOffset)
  const reach = opening.sillHeight + opening.height
  return opening.sillHeight >= 0 && reach <= top ? undefined : { reach, top }
}

function wallFaults(doc: HouseDocument, level: string): string[] {
  const faults: string[] = []
  const fault = (check: () => void) => {
    try {
      check()
    } catch (error) {
      if (!(error instanceof CommandError)) throw error
      faults.push(error.message)
    }
  }
  const walls = Object.values(doc.walls).filter((w) => w.level === level)
  for (const wall of walls) {
    const a = doc.nodes[wall.a]!,
      b = doc.nodes[wall.b]!
    const span = Math.hypot(b.x - a.x, b.y - a.y)
    if (span < 10) {
      faults.push(`Wall ${wall.id} is too short`)
      continue
    }
    if (wall.baseOffset < 0 || wall.baseOffset >= soffitOf(doc.levels[level]!)) {
      faults.push(`Wall ${wall.id} starts outside the storey`)
      continue
    }
    fault(() => wallProfile(doc, wall))
    const openings = Object.values(doc.openings).filter((o) => o.wall === wall.id)
    for (const o of openings) {
      if (o.t * span - o.width / 2 < -0.1 || o.t * span + o.width / 2 > span + 0.1)
        faults.push(`Opening ${o.id} no longer fits wall ${elementId(wall)}`)
      const high = openingReach(doc, o, wall)
      if (high)
        faults.push(
          `Opening ${o.id} no longer fits the wall height: it reaches ${high.reach} mm and the wall is open to ${high.top} mm`,
        )
      fault(() => checkFrame(doc, o, 'wall'))
      for (const other of openings) {
        if (o.id >= other.id) continue
        if (
          Math.abs(o.t - other.t) * span < (o.width + other.width) / 2 - 0.1 &&
          o.sillHeight < other.sillHeight + other.height &&
          other.sillHeight < o.sillHeight + o.height
        )
          faults.push(`Openings ${o.id} and ${other.id} overlap`)
      }
    }
  }
  for (let i = 0; i < walls.length; i++) {
    const one = walls[i]!,
      a = doc.nodes[one.a]!,
      b = doc.nodes[one.b]!
    for (const other of walls.slice(i + 1)) {
      const c = doc.nodes[other.a]!,
        d = doc.nodes[other.b]!
      const u = { x: b.x - a.x, y: b.y - a.y },
        v = { x: d.x - c.x, y: d.y - c.y }
      const cross = u.x * v.y - u.y * v.x
      if (Math.abs(cross) < 1e-6) {
        if (Math.abs((c.x - a.x) * u.y - (c.y - a.y) * u.x) > 0.1) continue
        const norm = u.x * u.x + u.y * u.y
        const t0 = ((c.x - a.x) * u.x + (c.y - a.y) * u.y) / norm
        const t1 = ((d.x - a.x) * u.x + (d.y - a.y) * u.y) / norm
        if (Math.min(1, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1)) > 1e-6)
          faults.push(`Walls ${one.id} and ${other.id} overlap`)
        continue
      }
      const t = ((c.x - a.x) * v.y - (c.y - a.y) * v.x) / cross
      const s = ((c.x - a.x) * u.y - (c.y - a.y) * u.x) / cross
      if (t < -1e-6 || t > 1 + 1e-6 || s < -1e-6 || s > 1 + 1e-6) continue
      if ([one.a, one.b].some((n) => n === other.a || n === other.b)) continue
      faults.push(`Walls ${one.id} and ${other.id} would cross without a junction`)
    }
  }
  fault(() => validateWallHosts(doc, level))
  fault(() => checkPockets(doc, level, 'wall'))
  return faults
}
