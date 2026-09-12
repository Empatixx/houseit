import { drawWall } from '@houseit/commands/draw-wall'
import { SNAP } from '@houseit/commands/partition'
import type { Point } from '@houseit/geometry/outlines'
import { roomsOf } from '@houseit/geometry/rooms'
import { sideOfWall, sideRun } from '@houseit/geometry/sides'
import { activeTools } from '../engine/native-tools'
import { drawStore, type Guide } from '../store/draw'
import { engineViewStore } from '../store/engine-view'
import { documentStore } from '../store/store'
import { toolStore } from '../store/tool'
import { endPreview, previewCommand } from './preview'
import { runEdit } from './run-edit'

const GRID = 50

type Axis = 'x' | 'y'

let aimSequence = 0
const gridPoint = (point: Point): Point =>
  engineViewStore.getState().snap
    ? { x: Math.round(point.x / GRID) * GRID, y: Math.round(point.y / GRID) * GRID }
    : point

function marksOn(drawn: Point[]): Point[] {
  const { doc, level } = documentStore.getState()
  const marks = drawn.slice(0, -1)
  for (const wall of Object.values(doc.walls)) {
    if (wall.level !== level) continue
    for (const id of [wall.a, wall.b]) {
      const node = doc.nodes[id]
      if (node) marks.push({ x: node.x, y: node.y })
    }
  }
  return marks
}

function aligned(point: Point, axes: Axis[], drawn: Point[]): { point: Point; guides: Guide[] } {
  const marks = marksOn(drawn)
  const cursor = { ...point }
  const from: Point[] = []
  for (const axis of axes) {
    const other: Axis = axis === 'x' ? 'y' : 'x'
    let best: { mark: Point; off: number; away: number } | undefined
    for (const mark of marks) {
      const off = Math.abs(mark[axis] - point[axis])
      if (off > SNAP) continue
      const away = Math.abs(mark[other] - point[other])
      if (!best || off < best.off || (off === best.off && away < best.away)) {
        best = { mark, off, away }
      }
    }
    if (!best) continue
    cursor[axis] = best.mark[axis]
    if (best.away >= 1) from.push(best.mark)
  }
  return { point: cursor, guides: from.map((mark) => ({ from: mark, to: { ...cursor } })) }
}

export function aimAt(point: Point): void {
  if (engineViewStore.getState().measure !== 'none') return
  const sequence = ++aimSequence
  const { points } = drawStore.getState()
  const last = points[points.length - 1]
  const horizontal = !last || Math.abs(point.x - last.x) >= Math.abs(point.y - last.y)
  const square = !last ? point : horizontal ? { x: point.x, y: last.y } : { x: last.x, y: point.y }
  const apply = (snapped: Point | null) => {
    if (sequence !== aimSequence || drawStore.getState().points !== points) return
    const target = snapped ?? gridPoint(square)
    const squared = !last
      ? target
      : horizontal
        ? { x: target.x, y: last.y }
        : { x: last.x, y: target.y }
    const aim =
      snapped || !engineViewStore.getState().snap
        ? { point: squared, guides: [] }
        : aligned(squared, last ? [horizontal ? 'x' : 'y'] : ['x', 'y'], points)
    drawStore.getState().aim(aim.point, aim.guides)
    const args = drawArgs([...points, aim.point])
    if (args) previewCommand(drawWall, args)
    else endPreview()
  }
  apply(null)
  void (activeTools?.snapPoint(square) ?? Promise.resolve(null)).then(apply)
}

export function putDown(point: Point): void {
  if (engineViewStore.getState().measure !== 'none') return
  aimSequence++
  const { points, cursor } = drawStore.getState()
  if (points.length === 0) {
    drawStore.getState().put(cursor ?? gridPoint(point))
    return
  }
  const corner = cursor ?? gridPoint(point)
  const last = points[points.length - 1]!
  const first = points[0]!
  const near = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) <= SNAP
  if (near(point, last) || near(corner, last)) {
    finishDrawing()
    return
  }
  drawStore.getState().put(corner)
  if (points.length >= 2 && near(corner, first)) finishDrawing()
}

toolStore.subscribe((state, previous) => {
  if (previous.armed?.kind === 'wall' && state.armed?.kind !== 'wall') cancelDrawing()
})

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

export function finishDrawing(): void {
  aimSequence++
  const { points } = drawStore.getState()
  const args = drawArgs(points)
  endPreview()
  drawStore.getState().clear()
  if (!args) return
  if (runEdit(() => documentStore.getState().apply(drawWall, args))) toolStore.getState().arm(null)
}

export function cancelDrawing(): void {
  aimSequence++
  endPreview()
  drawStore.getState().clear()
}
