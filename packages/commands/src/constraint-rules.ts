import type { Constraint, HouseDocument } from '@houseit/core/document'
import { interiorSize } from '@houseit/geometry/dimensions'
import { roomsOf } from '@houseit/geometry/rooms'
import type { Draft } from 'immer'
import { CommandError } from './command-error'

const TOLERANCE = 1
const PARALLEL = 0.001

type Measure = 'width' | 'depth'

export type ConstraintReport = Constraint & { holds: boolean; now: number | number[] }

export function measureOf(doc: HouseDocument, roomId: string, measure: Measure) {
  const stored = doc.rooms[roomId]
  if (!stored) return undefined
  const room = roomsOf(doc, stored.level).find((it) => it.id === roomId)
  if (!room) return undefined
  return interiorSize(doc, stored.level, room)[measure]
}

function directionOf(doc: HouseDocument, element: string) {
  const wall = Object.values(doc.walls).find((it) => (it.element ?? it.id) === element)
  const a = wall && doc.nodes[wall.a]
  const b = wall && doc.nodes[wall.b]
  if (!a || !b) return undefined
  const span = Math.hypot(b.x - a.x, b.y - a.y)
  return span === 0 ? undefined : { x: (b.x - a.x) / span, y: (b.y - a.y) / span }
}

const name = (doc: HouseDocument, room: string) => doc.rooms[room]?.name ?? room

export function reportConstraint(doc: HouseDocument, constraint: Constraint): ConstraintReport {
  if (constraint.kind === 'parallel') {
    const one = directionOf(doc, constraint.wall)
    const other = directionOf(doc, constraint.other)
    const cross = one && other ? Math.abs(one.x * other.y - one.y * other.x) : 0
    return { ...constraint, holds: cross <= PARALLEL, now: Math.round(cross * 1000) / 1000 }
  }
  const now = measureOf(doc, constraint.room, constraint.measure)
  if (constraint.kind === 'fixed') {
    return {
      ...constraint,
      holds: now === undefined || Math.abs(now - constraint.length) <= TOLERANCE,
      now: now ?? 0,
    }
  }
  const other = measureOf(doc, constraint.other, constraint.measure)
  return {
    ...constraint,
    holds: now === undefined || other === undefined || Math.abs(now - other) <= TOLERANCE,
    now: [now ?? 0, other ?? 0],
  }
}

function fault(doc: HouseDocument, report: ConstraintReport): string {
  if (report.kind === 'parallel')
    return `walls ${report.wall} and ${report.other} are held parallel (${report.id})`
  if (report.kind === 'fixed')
    return `the ${report.measure} of ${name(doc, report.room)} is fixed at ${report.length} mm (${report.id}); this would make it ${report.now} mm`
  const [one, two] = report.now as number[]
  return `${name(doc, report.room)} and ${name(doc, report.other)} are held to the same ${report.measure} (${report.id}); this would make them ${one} and ${two} mm`
}

export function assertConstraints(doc: HouseDocument | Draft<HouseDocument>): void {
  const plain = doc as HouseDocument
  for (const constraint of Object.values(plain.constraints ?? {})) {
    const report = reportConstraint(plain, constraint)
    if (!report.holds) throw new CommandError(fault(plain, report))
  }
}

export function pruneConstraints(draft: Draft<HouseDocument>): void {
  if (!draft.constraints) return
  const elements = new Set(Object.values(draft.walls).map((wall) => wall.element ?? wall.id))
  for (const constraint of Object.values(draft.constraints)) {
    const alive =
      constraint.kind === 'parallel'
        ? elements.has(constraint.wall) && elements.has(constraint.other)
        : draft.rooms[constraint.room] &&
          (constraint.kind === 'fixed' || draft.rooms[constraint.other])
    if (!alive) delete draft.constraints[constraint.id]
  }
  if (Object.keys(draft.constraints).length === 0) delete draft.constraints
}
