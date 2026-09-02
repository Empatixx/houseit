import { drawWall } from '@houseit/commands/draw-wall'
import { SNAP } from '@houseit/commands/partition'
import type { Point } from '@houseit/geometry/outlines'
import { roomsOf } from '@houseit/geometry/rooms'
import { sideOfWall, sideRun } from '@houseit/geometry/sides'
import { drawStore } from '../store/draw'
import { documentStore } from '../store/store'
import { toolStore } from '../store/tool'
import { endPreview, previewCommand } from './preview'
import { runEdit } from './run-edit'

/**
 * The pencil. A click puts a corner down; the line to the next follows the
 * pointer square to the last corner, snapping to the walls and corners it
 * comes near. A click on the corner before, or on the first corner, or Enter,
 * finishes: the corners become one `draw-wall`, a walk of legs from where
 * the first one was — on a side of a room, if it was, or a place on the
 * paper. Escape throws the drawing away.
 */

/** How near the pointer has to come to snap onto a corner, a wall, or the grid. */
const GRID = 50

/** A point the pointer means: on a corner or a wall it is near, else on the grid. */
function snapPoint(point: Point): Point {
  const { doc, level } = documentStore.getState()
  let best: { point: Point; distance: number } | undefined
  for (const node of Object.values(doc.nodes)) {
    const distance = Math.hypot(node.x - point.x, node.y - point.y)
    if (distance <= SNAP && (!best || distance < best.distance)) {
      best = { point: { x: node.x, y: node.y }, distance }
    }
  }
  if (best) return best.point
  for (const wall of Object.values(doc.walls)) {
    if (wall.level !== level) continue
    const a = doc.nodes[wall.a]
    const b = doc.nodes[wall.b]
    if (!a || !b) continue
    const lengthSquared = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
    if (lengthSquared === 0) continue
    const t = ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / lengthSquared
    if (t < 0 || t > 1) continue
    const foot = { x: Math.round(a.x + (b.x - a.x) * t), y: Math.round(a.y + (b.y - a.y) * t) }
    const distance = Math.hypot(foot.x - point.x, foot.y - point.y)
    if (distance <= SNAP && (!best || distance < best.distance)) best = { point: foot, distance }
  }
  if (best) return best.point
  return { x: Math.round(point.x / GRID) * GRID, y: Math.round(point.y / GRID) * GRID }
}

/** The next corner the pointer means: square to the last, then snapped along that line. */
export function aimAt(point: Point): void {
  const { points } = drawStore.getState()
  const last = points[points.length - 1]
  if (!last) {
    drawStore.getState().aim(snapPoint(point))
    return
  }
  const dx = point.x - last.x
  const dy = point.y - last.y
  const square =
    Math.abs(dx) >= Math.abs(dy) ? { x: point.x, y: last.y } : { x: last.x, y: point.y }
  const snapped = snapPoint(square)
  // Snapping may not pull the line off its axis.
  const cursor =
    Math.abs(dx) >= Math.abs(dy) ? { x: snapped.x, y: last.y } : { x: last.x, y: snapped.y }
  drawStore.getState().aim(cursor)
  const args = drawArgs([...points, cursor])
  if (args) previewCommand(drawWall, args)
  else endPreview()
}

/** A click: the first corner, the next one, or — on the corner before or the first — the end. */
export function putDown(point: Point): void {
  const { points, cursor } = drawStore.getState()
  if (points.length === 0) {
    drawStore.getState().put(snapPoint(point))
    return
  }
  const corner = cursor ?? snapPoint(point)
  const last = points[points.length - 1]!
  const first = points[0]!
  // A click on the corner before — near enough, by hand — is the end of the line.
  const near = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) <= SNAP
  if (near(point, last) || near(corner, last)) {
    finishDrawing()
    return
  }
  drawStore.getState().put(corner)
  if (points.length >= 2 && near(corner, first)) finishDrawing()
}

// The pencil put down is a drawing thrown away.
toolStore.subscribe((state, previous) => {
  if (previous.armed?.kind === 'wall' && state.armed?.kind !== 'wall') cancelDrawing()
})

/** The corners as the command takes them: legs from the first one. */
function drawArgs(points: Point[]) {
  if (points.length < 2) return undefined
  const legs: string[] = []
  for (let i = 0; i + 1 < points.length; i += 1) {
    const from = points[i]!
    const to = points[i + 1]!
    const dx = Math.round(to.x - from.x)
    const dy = Math.round(to.y - from.y)
    if (dx === 0 && dy === 0) continue
    if (dx !== 0 && dy !== 0) return undefined
    legs.push(
      dx !== 0 ? `${Math.abs(dx)} ${dx > 0 ? 'e' : 'w'}` : `${Math.abs(dy)} ${dy > 0 ? 'n' : 's'}`,
    )
  }
  if (legs.length === 0) return undefined
  return { ...startOf(points[0]!), walk: legs.join(', ') }
}

/** Where the walk starts, said as a room's side when the first corner is on one. */
function startOf(
  first: Point,
): { at: string } | { room: string; side: 'north' | 'south' | 'east' | 'west'; along: number } {
  const { doc, level } = documentStore.getState()
  for (const room of roomsOf(doc, level)) {
    if (!room.name) continue
    for (const wall of Object.values(doc.walls)) {
      if (wall.level !== level) continue
      const a = doc.nodes[wall.a]
      const b = doc.nodes[wall.b]
      if (!a || !b) continue
      const cross = (b.x - a.x) * (first.y - a.y) - (b.y - a.y) * (first.x - a.x)
      const dot = (first.x - a.x) * (b.x - a.x) + (first.y - a.y) * (b.y - a.y)
      const onWall =
        Math.abs(cross) < 0.5 * Math.hypot(b.x - a.x, b.y - a.y) &&
        dot >= 0 &&
        dot <= (b.x - a.x) ** 2 + (b.y - a.y) ** 2
      if (!onWall) continue
      const side = sideOfWall(doc, level, room, wall.id)
      if (!side) continue
      const run = sideRun(doc, level, room, side)
      if (!run || run.length === 0) continue
      const unit = {
        x: (run.to.x - run.from.x) / run.length,
        y: (run.to.y - run.from.y) / run.length,
      }
      const along = ((first.x - run.from.x) * unit.x + (first.y - run.from.y) * unit.y) / run.length
      if (along < -0.001 || along > 1.001) continue
      return {
        room: room.name,
        side,
        along: Math.round(Math.min(1, Math.max(0, along)) * 1000) / 1000,
      }
    }
  }
  return { at: `${Math.round(first.x)},${Math.round(first.y)}` }
}

/** The drawing becomes walls, as one command; or nothing, if it is only a point. */
export function finishDrawing(): void {
  const { points } = drawStore.getState()
  const args = drawArgs(points)
  endPreview()
  drawStore.getState().clear()
  if (!args) return
  if (runEdit(() => documentStore.getState().apply(drawWall, args))) toolStore.getState().arm(null)
}

/** The drawing is thrown away. */
export function cancelDrawing(): void {
  endPreview()
  drawStore.getState().clear()
}
