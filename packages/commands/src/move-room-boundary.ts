import type { HouseDocument, Wall } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { SIDES, sideOfWall } from '@houseit/geometry/sides'
import { elementId } from '@houseit/geometry/wall-elements'
import { allocateId } from './allocate-id'
import { CommandError } from './command-error'
import { collinear, wallsAt } from './graph'
import { linkPoints } from './partition'
import { rebind } from './rebind'
import { validateWalls } from './wall'
import { furnitureBefore, retainFurniture } from './wall-furniture'
import { connectCrossings, moveWallJunctions } from './wall-junctions'

export function moveRoomBoundary(
  doc: HouseDocument,
  roomId: string,
  wallId: string,
  by: number,
): { changed: string[]; at: string } {
  try {
    const room = doc.rooms[roomId]
    const wall = doc.walls[wallId]
    if (!room || !wall || !room.loop.includes(wallId))
      throw new CommandError('select a wall segment on this room boundary')
    if (by === 0) return { changed: [], at: room.level }
    const before = roomsOf(doc, room.level)
    const face = before.find((r) => r.id === roomId)!
    const side = sideOfWall(doc, room.level, face, wallId)
    if (!side) throw new CommandError('this boundary has no outward direction')
    const { axis, low } = SIDES[side]
    const a = doc.nodes[wall.a]!,
      b = doc.nodes[wall.b]!
    const span = Math.hypot(b.x - a.x, b.y - a.y)
    const normal = axis === 'x' ? -(b.y - a.y) / span : (b.x - a.x) / span
    const distance = Math.round(by * (low ? -1 : 1) * normal)
    const shift = {
      x: Math.round((-(b.y - a.y) / span) * distance),
      y: Math.round(((b.x - a.x) / span) * distance),
    }
    const crossing = firstJunction(doc, wall, shift, by)
    if (crossing !== undefined) {
      const first = moveRoomBoundary(doc, roomId, wallId, crossing)
      const rest = moveRoomBoundary(doc, roomId, wallId, by - crossing)
      return { changed: [...new Set([...first.changed, ...rest.changed])], at: room.level }
    }
    const furniture = furnitureBefore(doc, room.level)
    const groups = new Set([elementId(wall)])
    const steps: { from: string; to: string }[] = []
    for (const end of ['a', 'b'] as const) {
      const node = wall[end]
      const here = doc.nodes[node]!
      const others = wallsAt(doc, room.level, node).filter((other) => other.id !== wall.id)
      if (!others.some((other) => collinear(doc, wall, other))) continue
      const id = allocateId(doc.nodes, 'n')
      doc.nodes[id] = { ...here, id }
      wall[end] = id
      steps.push({ from: node, to: id })
      for (const other of others) {
        if (collinear(doc, wall, other)) continue
        const far = doc.nodes[other.a === node ? other.b : other.a]!
        const reach = (far.x - here.x) * shift.x + (far.y - here.y) * shift.y
        if (reach <= 0) continue
        if (reach <= shift.x ** 2 + shift.y ** 2)
          throw new CommandError('this move would collapse a connected wall')
        groups.add(elementId(other))
        if (other.a === node) other.a = id
        else other.b = id
      }
    }
    separateRuns(doc, groups)
    const affected = moveWallJunctions(doc, elementId(wall), distance, {
      connect: false,
      collapse: true,
    })
    for (const step of steps) {
      const made = linkPoints(
        doc,
        room.level,
        doc.nodes[step.from]!,
        doc.nodes[step.to]!,
        wall.thickness,
        'move-wall',
      )
      for (const id of made) {
        Object.assign(doc.walls[id]!, {
          element: made[0]!,
          height: wall.height,
          baseOffset: wall.baseOffset,
          ...(wall.exterior ? { exterior: wall.exterior } : {}),
        })
        affected.push(id)
      }
    }
    connectCrossings(doc, room.level)
    validateWalls(doc, room.level)
    rebind(doc, room.level)
    const after = roomsOf(doc, room.level)
    if (after.length !== before.length || before.some((r) => r.id && !doc.rooms[r.id]?.loop.length))
      throw new CommandError('this move would destroy or divide an existing room')
    retainFurniture(doc, room.level, furniture)
    return {
      changed: [...new Set([...affected, ...before.flatMap((r) => (r.id ? [r.id] : []))])],
      at: room.level,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new CommandError(`move-wall: ${message.replace(/^(?:(?:move|update)-wall: )+/, '')}`)
  }
}

function firstJunction(
  doc: HouseDocument,
  wall: Wall,
  shift: { x: number; y: number },
  by: number,
) {
  const squared = shift.x ** 2 + shift.y ** 2
  let nearest = 1
  for (const node of [wall.a, wall.b]) {
    const here = doc.nodes[node]!
    for (const other of wallsAt(doc, wall.level, node)) {
      if (other.id === wall.id || collinear(doc, wall, other)) continue
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
