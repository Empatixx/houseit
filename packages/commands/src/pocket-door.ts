import type { HouseDocument, Opening, Side } from '@houseit/core/document'
import { pocketShift } from '@houseit/core/opening-parts'
import { boxOf, clashes, wallBox } from '@houseit/geometry/boxes'
import { shaftOutside, shaftsOn } from '@houseit/geometry/connections'
import { freeSpans } from '@houseit/geometry/spans'
import type { Draft } from 'immer'
import { CommandError } from './command-error'

export function pocketDirection(doc: HouseDocument, opening: Opening): Side {
  const wall = doc.walls[opening.wall]!,
    a = doc.nodes[wall.a]!,
    b = doc.nodes[wall.b]!
  const sign = Math.sign(pocketShift(opening))
  return a.x === b.x
    ? (b.y - a.y) * sign > 0
      ? 'north'
      : 'south'
    : (b.x - a.x) * sign > 0
      ? 'east'
      : 'west'
}

export function setPocket(
  doc: Draft<HouseDocument>,
  opening: Draft<Opening>,
  towards: Side | undefined,
  what: string,
) {
  if (opening.kind !== 'door' || opening.variant !== 'pocket') {
    if (towards !== undefined)
      throw new CommandError(`${what}: --slide-towards needs a pocket door`)
    opening.slide = undefined
    return
  }
  const wall = doc.walls[opening.wall]!,
    a = doc.nodes[wall.a]!,
    b = doc.nodes[wall.b]!
  const dx = b.x - a.x,
    dy = b.y - a.y,
    span = Math.hypot(dx, dy),
    middle = opening.t * span
  if (dx !== 0 && dy !== 0) throw new CommandError(`${what}: pocket doors need an orthogonal wall`)
  const wanted =
    towards === undefined
      ? undefined
      : towards === 'east'
        ? { x: 1, y: 0 }
        : towards === 'west'
          ? { x: -1, y: 0 }
          : towards === 'north'
            ? { x: 0, y: 1 }
            : { x: 0, y: -1 }
  if (wanted && dx * wanted.x + dy * wanted.y === 0)
    throw new CommandError(`${what}: --slide-towards must follow the wall`)
  const explicit = wanted ? (dx * wanted.x + dy * wanted.y < 0 ? 'a' : 'b') : opening.slide
  const fits = (side: 'a' | 'b') => {
    const sign = side === 'a' ? -1 : 1,
      centre = middle + sign * opening.width
    const from = centre - opening.width / 2,
      to = centre + opening.width / 2
    const at = (t: number) => ({ x: a.x + (dx * t) / span, y: a.y + (dy * t) / span })
    const box = wallBox(at(from), at(to), 40)
    const cover = Object.values(doc.walls)
      .filter(
        (w) =>
          w.level === wall.level &&
          w.thickness >= 60 &&
          w.baseOffset <= 0 &&
          w.height >= opening.height,
      )
      .flatMap((w) => {
        const p = doc.nodes[w.a]!,
          q = doc.nodes[w.b]!
        if (dx === 0 ? p.x !== a.x || q.x !== a.x : p.y !== a.y || q.y !== a.y) return []
        const project = (p: { x: number; y: number }) =>
          ((p.x - a.x) * dx + (p.y - a.y) * dy) / span
        return [
          {
            from: Math.max(0, Math.min(project(p), project(q)) - from),
            to: Math.min(to - from, Math.max(project(p), project(q)) - from),
          },
        ].filter((s) => s.to > s.from)
      })
    if (freeSpans(to - from, cover).length) return false
    for (const other of Object.values(doc.openings)) {
      if (other.id === opening.id) continue
      const w = doc.walls[other.wall]!
      if (w.level !== wall.level) continue
      const p = doc.nodes[w.a]!,
        q = doc.nodes[w.b]!,
        length = Math.hypot(q.x - p.x, q.y - p.y)
      const point = (t: number) => ({
        x: p.x + ((q.x - p.x) * t) / length,
        y: p.y + ((q.y - p.y) * t) / length,
      })
      const centres = [
        other.t * length,
        ...(other.variant === 'pocket' ? [other.t * length + pocketShift(other)] : []),
      ]
      if (
        centres.some((c) =>
          clashes(
            box,
            wallBox(point(c - other.width / 2), point(c + other.width / 2), w.thickness),
            0,
          ),
        )
      )
        return false
    }
    if (
      (doc.levels[wall.level]!.columns ?? []).some((c) =>
        clashes(
          box,
          {
            x0: c.x - c.width / 2,
            x1: c.x + c.width / 2,
            y0: c.y - c.depth / 2,
            y1: c.y + c.depth / 2,
          },
          0,
        ),
      )
    )
      return false
    if (shaftsOn(doc, wall.level).some((s) => clashes(box, boxOf(shaftOutside(s)), 0))) return false
    return true
  }
  const side = (explicit ? [explicit] : (['a', 'b'] as const)).find(fits)
  if (!side)
    throw new CommandError(
      `${what}: no uninterrupted wall for the pocket${towards ? ` towards ${towards}` : ''}`,
    )
  opening.slide = side
}

export function checkPockets(doc: Draft<HouseDocument>, level: string, what: string) {
  for (const o of Object.values(doc.openings))
    if (o.variant === 'pocket' && doc.walls[o.wall]?.level === level)
      setPocket(doc, o, undefined, what)
}
