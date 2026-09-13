import type { HouseDocument, Wall } from '@houseit/core/document'
import { wallHosts } from '@houseit/core/wall-hosts'
import type { Point } from '@houseit/geometry/outlines'
import { elementId, wallElement } from '@houseit/geometry/wall-elements'
import { CommandError } from './command-error'
import { splitWall } from './split-wall'

const cross = (u: Point, v: Point) => u.x * v.y - u.y * v.x
const delta = (a: Point, b: Point) => ({ x: b.x - a.x, y: b.y - a.y })
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

export function moveWallJunctions(
  doc: HouseDocument,
  id: string,
  by: number,
  options: { connect?: boolean; collapse?: boolean } = {},
): string[] {
  const wall = wallElement(doc, id)
  const moving = new Set(wall.segments.flatMap((s) => [s.wall.a, s.wall.b]))
  const affected = new Set(
    Object.values(doc.walls)
      .filter((w) => moving.has(w.a) || moving.has(w.b))
      .map(elementId),
  )
  const prior = new Map(
    [...affected].map((id) => {
      const e = wallElement(doc, id)
      return [
        id,
        { id, from: { ...e.from }, to: { ...e.to }, length: e.length, unit: { ...e.unit } },
      ]
    }),
  )
  const anchors = [
    ...Object.values(doc.openings).map((host) => ({ host, label: `Opening ${host.id}` })),
    ...wallHosts(doc).map(({ host, id }) => ({ host, label: `Wall host ${id}` })),
  ].flatMap(({ host, label }) => {
    const segment = doc.walls[host.wall]!
    const id = elementId(segment)
    if (!affected.has(id)) return []
    const e = wallElement(doc, id),
      s = e.segments.find((s) => s.wall.id === host.wall)!
    return [
      {
        host,
        label,
        id,
        at: s.from + (s.to - s.from) * host.t,
        width: 'width' in host ? host.width : 0,
      },
    ]
  })
  const original = prior.get(wall.id)!
  const shift = { x: Math.round(-original.unit.y * by), y: Math.round(original.unit.x * by) }
  const from = { x: original.from.x + shift.x, y: original.from.y + shift.y }
  const positions = new Map<string, Point>()
  for (const node of moving) {
    const here = doc.nodes[node]!
    const joins = Object.values(doc.walls).filter(
      (w) => elementId(w) !== wall.id && (w.a === node || w.b === node),
    )
    let chosen: Point | undefined
    for (const other of joins) {
      const line = prior.get(elementId(other))!
      const denominator = cross(original.unit, line.unit)
      if (Math.abs(denominator) < 1e-8) continue
      const t = cross(delta(from, line.from), line.unit) / denominator
      const point = { x: from.x + original.unit.x * t, y: from.y + original.unit.y * t }
      if (chosen && distance(chosen, point) > 1.5)
        throw new CommandError('update-wall: junction directions impose incompatible positions')
      chosen = point
    }
    const next = chosen ?? { x: here.x + shift.x, y: here.y + shift.y }
    positions.set(node, { x: Math.round(next.x), y: Math.round(next.y) })
  }
  for (const [id, point] of positions) Object.assign(doc.nodes[id]!, point)
  const collapsed = new Set<string>()
  if (options.collapse) {
    for (const candidate of Object.values(doc.walls).filter((w) => w.level === wall.level)) {
      if (distance(doc.nodes[candidate.a]!, doc.nodes[candidate.b]!) >= 1) continue
      const id = elementId(candidate)
      if (
        Object.values(doc.walls).filter((w) => elementId(w) === id).length !== 1 ||
        anchors.some((anchor) => anchor.id === id)
      )
        throw new CommandError(
          'update-wall: cannot collapse a wall that still has segments or hosts',
        )
      const keep = moving.has(candidate.a) ? candidate.b : candidate.a
      const remove = keep === candidate.a ? candidate.b : candidate.a
      delete doc.walls[candidate.id]
      for (const other of Object.values(doc.walls)) {
        if (other.level !== wall.level) continue
        if (other.a === remove) other.a = keep
        if (other.b === remove) other.b = keep
      }
      if (!Object.values(doc.walls).some((w) => w.a === remove || w.b === remove))
        delete doc.nodes[remove]
      collapsed.add(id)
    }
  }
  for (const old of prior.values()) {
    if (collapsed.has(old.id)) continue
    const next = wallElement(doc, old.id)
    if (next.length < 10 || next.unit.x * old.unit.x + next.unit.y * old.unit.y <= 0)
      throw new CommandError(`update-wall: connected wall ${old.id} would collapse or reverse`)
  }
  for (const anchor of anchors) {
    const old = prior.get(anchor.id)!,
      next = wallElement(doc, anchor.id)
    const movedStart = moving.has(old.from.id),
      movedEnd = moving.has(old.to.id)
    const at =
      anchor.id !== wall.id && movedStart && !movedEnd
        ? next.length - (old.length - anchor.at)
        : anchor.at
    const part = next.segments.find(
      (s) => at - anchor.width / 2 >= s.from - 0.0001 && at + anchor.width / 2 <= s.to + 0.0001,
    )
    if (!part)
      throw new CommandError(`update-wall: ${anchor.label} no longer fits between wall junctions`)
    anchor.host.wall = part.wall.id
    anchor.host.t = (at - part.from) / (part.to - part.from)
  }
  if (options.connect !== false)
    for (const id of connectCrossings(doc, wall.level)) affected.add(id)
  return [...affected]
}

export function connectCrossings(doc: HouseDocument, level: string): Set<string> {
  const walls = Object.values(doc.walls).filter((w) => w.level === level)
  const hits: { one: string; other: string; point: Point }[] = []
  for (let i = 0; i < walls.length; i++) {
    const one = walls[i]!,
      a = doc.nodes[one.a]!,
      b = doc.nodes[one.b]!,
      u = delta(a, b)
    for (const other of walls.slice(i + 1)) {
      if ([one.a, one.b].some((n) => n === other.a || n === other.b)) continue
      const c = doc.nodes[other.a]!,
        d = doc.nodes[other.b]!,
        v = delta(c, d),
        denominator = cross(u, v)
      if (Math.abs(denominator) < 1e-8) continue
      const t = cross(delta(a, c), v) / denominator,
        s = cross(delta(a, c), u) / denominator
      if (t < 0 || t > 1 || s < 0 || s > 1) continue
      hits.push({
        one: elementId(one),
        other: elementId(other),
        point: { x: Math.round(a.x + u.x * t), y: Math.round(a.y + u.y * t) },
      })
    }
  }
  const changed = new Set<string>()
  for (const hit of hits) {
    const first = nodeOn(doc, hit.one, hit.point)
    nodeOn(doc, hit.other, doc.nodes[first]!, first)
    changed.add(hit.one)
    changed.add(hit.other)
  }
  return changed
}

function nodeOn(doc: HouseDocument, id: string, point: Point, existing?: string): string {
  const element = wallElement(doc, id)
  const wall = element.segments.find(({ wall }) => onSegment(doc, wall, point))?.wall
  if (!wall) throw new CommandError(`update-wall: cannot resolve junction on ${id}`)
  const end = [wall.a, wall.b].find((id) => distance(doc.nodes[id]!, point) < 1.5)
  if (end) {
    if (existing && end !== existing) {
      for (const w of Object.values(doc.walls)) {
        if (w.level !== element.level) continue
        if (w.a === end) w.a = existing
        if (w.b === end) w.b = existing
      }
      delete doc.nodes[end]
      return existing
    }
    return end
  }
  return splitWall(doc, wall.id, point, existing)
}

function onSegment(doc: HouseDocument, wall: Wall, p: Point): boolean {
  const a = doc.nodes[wall.a]!,
    b = doc.nodes[wall.b]!,
    u = delta(a, b),
    v = delta(a, p)
  const length = Math.hypot(u.x, u.y)
  const at = (u.x * v.x + u.y * v.y) / length
  return at >= -1 && at <= length + 1 && Math.abs(cross(u, v)) / length <= 1
}
