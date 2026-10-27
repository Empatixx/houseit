import { z } from 'zod'

const mm = z.number().int()
const point = z.object({ x: mm, y: mm })
const colour = z.string().regex(/^#[0-9a-f]{6}$/i)

export const FENCE_KINDS = ['boards', 'slats', 'mesh', 'bars', 'gabion', 'wall'] as const
export type FenceKind = (typeof FENCE_KINDS)[number]

export const FENCES: Record<FenceKind, { label: string; height: number; colour: string }> = {
  boards: { label: 'horizontal board fence', height: 1600, colour: '#8a6a4c' },
  slats: { label: 'vertical slat fence', height: 1400, colour: '#9b7b57' },
  mesh: { label: 'wire mesh fence', height: 1500, colour: '#3d5a3a' },
  bars: { label: 'metal bar fence', height: 1500, colour: '#3a3d41' },
  gabion: { label: 'gabion wall', height: 1200, colour: '#d9d3c7' },
  wall: { label: 'garden wall', height: 1500, colour: '#e6e1d8' },
}

export const GateSchema = z.object({
  at: mm.nonnegative(),
  width: mm.positive(),
  kind: z.enum(['gate', 'opening']).default('gate'),
})

export const FenceSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(FENCE_KINDS),
  points: z.array(point).min(2),
  closed: z.boolean().default(false),
  height: mm.positive(),
  colour,
  gates: z.array(GateSchema).default([]),
})

export type Fence = z.infer<typeof FenceSchema>
export type Gate = z.infer<typeof GateSchema>

export function fenceRuns(fence: Pick<Fence, 'points' | 'closed'>) {
  const corners = fence.closed ? [...fence.points, fence.points[0]!] : fence.points
  let travelled = 0
  return corners.slice(1).map((to, index) => {
    const from = corners[index]!
    const length = Math.hypot(to.x - from.x, to.y - from.y)
    const run = { from, to, start: travelled, length }
    travelled += length
    return run
  })
}

export const fenceLength = (fence: Pick<Fence, 'points' | 'closed'>) =>
  fenceRuns(fence).reduce((sum, run) => sum + run.length, 0)

type Point = { x: number; y: number }

export type Stretch = { from: Point; to: Point; gate?: boolean }

export function fenceStretches(fence: Fence): Stretch[] {
  const stretches: Stretch[] = []
  const gates = [...fence.gates].sort((one, other) => one.at - other.at)
  for (const run of fenceRuns(fence)) {
    const point = (distance: number): Point => {
      const t = (distance - run.start) / (run.length || 1)
      return {
        x: run.from.x + (run.to.x - run.from.x) * t,
        y: run.from.y + (run.to.y - run.from.y) * t,
      }
    }
    let cursor = run.start
    const end = run.start + run.length
    for (const gate of gates) {
      const from = Math.max(gate.at, run.start)
      const to = Math.min(gate.at + gate.width, end)
      if (to <= from) continue
      if (from > cursor) stretches.push({ from: point(cursor), to: point(from) })
      if (gate.kind === 'gate') stretches.push({ from: point(from), to: point(to), gate: true })
      cursor = to
    }
    if (end > cursor) stretches.push({ from: point(cursor), to: point(end) })
  }
  return stretches
}
