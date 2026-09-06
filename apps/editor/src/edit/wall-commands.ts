import { moveWall } from '@houseit/commands/move-wall'
import { removeRoom } from '@houseit/commands/remove-room'
import { removeWall, resizeWall } from '@houseit/commands/stub-commands'
import { type Stub, stubsOn } from '@houseit/commands/stubs'
import type { Wall } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { SIDES, sideOfWall } from '@houseit/geometry/sides'
import { documentStore } from '../store/store'
import { sayError } from './notice'
import { endPreview, previewCommand } from './preview'
import { runEdit } from './run-edit'

function wallMoveArgs(wall: Wall, shift: Point) {
  const named = nameWall(wall)
  if (!named) return undefined
  const { axis, low } = SIDES[named.side]
  const outward = low ? -1 : 1
  const by = Math.round((shift[axis] * outward) / 10) * 10
  return { room: named.room.name, side: named.side, by }
}

export function moveWallBy(wall: Wall, shift: Point): boolean {
  const args = wallMoveArgs(wall, shift)
  if (!args) return false
  if (args.by === 0) return true
  return runEdit(() => documentStore.getState().apply(moveWall, args))
}

export function previewWallMove(wall: Wall, shift: Point): void {
  const args = wallMoveArgs(wall, shift)
  if (!args || args.by === 0) {
    endPreview()
    return
  }
  previewCommand(moveWall, args)
}

export function knockThrough(room: Room, into: string): boolean {
  if (!room.name) return false
  return runEdit(() => documentStore.getState().apply(removeRoom, { room: room.name!, into }))
}

export function nameWall(wall: Wall) {
  const { doc, level } = documentStore.getState()
  for (const room of roomsOf(doc, level)) {
    if (!room.name) continue
    const side = sideOfWall(doc, level, room, wall.id)
    if (side) return { room: { ...room, name: room.name }, side }
  }
  sayError('this wall bounds no named room, so nothing can be said about it')
  return undefined
}

const SIDE_LIST = ['north', 'east', 'south', 'west'] as const

export function stubOf(
  wall: Wall,
): { room: Room & { name: string }; side: (typeof SIDE_LIST)[number]; stub: Stub } | undefined {
  const { doc, level } = documentStore.getState()
  for (const room of roomsOf(doc, level)) {
    if (!room.name || !room.nodes.includes(wall.a) || !room.nodes.includes(wall.b)) continue
    for (const side of SIDE_LIST) {
      const stub = stubsOn(doc, level, room, side).find(
        (candidate) => candidate.wall.id === wall.id,
      )
      if (stub) return { room: { ...room, name: room.name }, side, stub }
    }
  }
  return undefined
}

export function removeStub(wall: Wall): boolean {
  const found = stubOf(wall)
  if (!found) {
    sayError('this wall bounds rooms; knock a room through to take it out')
    return false
  }
  return runEdit(() =>
    documentStore
      .getState()
      .apply(removeWall, { room: found.room.name, side: found.side, along: found.stub.along }),
  )
}

function stubResizeArgs(wall: Wall, length: number) {
  const found = stubOf(wall)
  if (!found) return undefined
  const rounded = Math.max(10, Math.round(length / 10) * 10)
  if (rounded === found.stub.length) return undefined
  return { room: found.room.name, side: found.side, along: found.stub.along, length: rounded }
}

export function resizeStub(wall: Wall, length: number): boolean {
  const args = stubResizeArgs(wall, length)
  if (!args) return stubOf(wall) !== undefined
  return runEdit(() => documentStore.getState().apply(resizeWall, args))
}

export function previewStubResize(wall: Wall, length: number): void {
  const args = stubResizeArgs(wall, length)
  if (!args) {
    endPreview()
    return
  }
  previewCommand(resizeWall, args)
}
