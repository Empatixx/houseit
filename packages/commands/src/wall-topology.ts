import type { HouseDocument, Wall } from '@houseit/core/document'
import { elementId, wallElement } from '@houseit/geometry/wall-elements'
import { allocateId } from './allocate-id'
import { CommandError } from './command-error'
import { collinear, wallsAt } from './graph'
import { linkPoints } from './partition'
import { connectCrossings, moveWallJunctions } from './wall-junctions'

export function moveWallTopology(
  doc: HouseDocument,
  id: string,
  by: number,
  scope: 'segment' | 'element',
): string[] {
  if (by === 0) return []
  const walls =
    scope === 'segment' ? [doc.walls[id]!] : wallElement(doc, id).segments.map((s) => s.wall)
  const wall = walls[0]!
  const a = doc.nodes[wall.a]!,
    b = doc.nodes[wall.b]!
  const span = Math.hypot(b.x - a.x, b.y - a.y)
  const shift = {
    x: Math.round((-(b.y - a.y) / span) * by),
    y: Math.round(((b.x - a.x) / span) * by),
  }
  const selected = new Set(walls.map((w) => w.id))
  const crossing = firstJunction(doc, walls, shift, by)
  if (crossing !== undefined) {
    const first = moveWallTopology(doc, id, crossing, scope)
    const rest = moveWallTopology(doc, id, by - crossing, scope)
    return [...new Set([...first, ...rest])]
  }
  const groups = new Set(walls.map(elementId))
  const steps: { from: string; to: string; wall: Wall }[] = []
  for (const node of new Set(walls.flatMap((w) => [w.a, w.b]))) {
    const segment = walls.find((w) => w.a === node || w.b === node)!
    const here = doc.nodes[node]!
    const others = wallsAt(doc, wall.level, node).filter((other) => !selected.has(other.id))
    if (!others.some((other) => collinear(doc, segment, other))) continue
    const made = allocateId(doc.nodes, 'n')
    doc.nodes[made] = { ...here, id: made }
    for (const part of walls) {
      if (part.a === node) part.a = made
      if (part.b === node) part.b = made
    }
    steps.push({ from: node, to: made, wall: segment })
    for (const other of others) {
      if (collinear(doc, segment, other)) continue
      const far = doc.nodes[other.a === node ? other.b : other.a]!
      const reach = (far.x - here.x) * shift.x + (far.y - here.y) * shift.y
      if (reach <= 0) continue
      if (reach <= shift.x ** 2 + shift.y ** 2)
        throw new CommandError('this move would collapse a connected wall')
      groups.add(elementId(other))
      if (other.a === node) other.a = made
      else other.b = made
    }
  }
  separateRuns(doc, groups)
  const affected = moveWallJunctions(doc, elementId(wall), by, { connect: false, collapse: true })
  for (const step of steps) {
    const made = linkPoints(
      doc,
      wall.level,
      doc.nodes[step.from]!,
      doc.nodes[step.to]!,
      step.wall.thickness,
      'move-wall',
    )
    for (const id of made) {
      Object.assign(doc.walls[id]!, {
        element: made[0]!,
        height: step.wall.height,
        baseOffset: step.wall.baseOffset,
        ...(step.wall.exterior ? { exterior: step.wall.exterior } : {}),
      })
      affected.push(id)
    }
  }
  return [...new Set([...affected, ...connectCrossings(doc, wall.level)])]
}

function firstJunction(
  doc: HouseDocument,
  walls: Wall[],
  shift: { x: number; y: number },
  by: number,
) {
  const squared = shift.x ** 2 + shift.y ** 2
  let nearest = 1
  const selected = new Set(walls.map((w) => w.id))
  const wall = walls[0]!
  for (const node of new Set(walls.flatMap((w) => [w.a, w.b]))) {
    const here = doc.nodes[node]!
    for (const other of wallsAt(doc, wall.level, node)) {
      if (selected.has(other.id) || collinear(doc, wall, other)) continue
      const far = doc.nodes[other.a === node ? other.b : other.a]!
      const fraction = ((far.x - here.x) * shift.x + (far.y - here.y) * shift.y) / squared
      if (fraction > 0 && fraction < nearest) nearest = fraction
    }
  }
  const step = Math.round(by * nearest)
  return step !== 0 && Math.abs(step) < Math.abs(by) ? step : undefined
}

function separateRuns(doc: HouseDocument, groups: Set<string>) {
  for (const group of groups) {
    const walls = Object.values(doc.walls).filter((wall) => elementId(wall) === group)
    const ends = new Set(walls.map((wall) => wall.b))
    const byStart = new Map(walls.map((wall) => [wall.a, wall]))
    const visited = new Set<string>()
    for (const start of walls.filter((wall) => !ends.has(wall.a))) {
      const run: Wall[] = []
      let current: Wall | undefined = start
      while (current && !visited.has(current.id)) {
        visited.add(current.id)
        run.push(current)
        current = byStart.get(current.b)
      }
      const id = run.some((wall) => wall.id === group) ? group : start.id
      for (const wall of run) wall.element = id
    }
    if (visited.size !== walls.length) throw new CommandError('cannot separate this wall junction')
  }
}
