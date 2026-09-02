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

/** What a drag of a wall, or a button on a room, does — as the commands an agent would give. */

/** What `move-wall` is asked for a wall carried this far across itself, to the nearest centimetre. */
function wallMoveArgs(wall: Wall, shift: Point) {
  const named = nameWall(wall)
  if (!named) return undefined
  const { axis, low } = SIDES[named.side]
  const outward = low ? -1 : 1
  const by = Math.round((shift[axis] * outward) / 10) * 10
  return { room: named.room.name, side: named.side, by }
}

/** Moves a wall by however far across itself it was carried, as `move-wall` on a room it bounds. */
export function moveWallBy(wall: Wall, shift: Point): boolean {
  const args = wallMoveArgs(wall, shift)
  if (!args) return false
  if (args.by === 0) return true
  return runEdit(() => documentStore.getState().apply(moveWall, args))
}

/** Shows where the wall, and the rooms round it, would come to. */
export function previewWallMove(wall: Wall, shift: Point): void {
  const args = wallMoveArgs(wall, shift)
  if (!args || args.by === 0) {
    endPreview()
    return
  }
  previewCommand(moveWall, args)
}

/** Knocks a room through into a neighbour. */
export function knockThrough(room: Room, into: string): boolean {
  if (!room.name) return false
  return runEdit(() => documentStore.getState().apply(removeRoom, { room: room.name!, into }))
}

/**
 * A wall the way `move-wall` names it: a room it bounds and the side of that
 * room it is on. Any room bounding it will do — moving the wall moves it for
 * both — so the first named one is taken.
 */
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

/**
 * A wall as a stub, if it is one: hanging off one side of a named room with
 * its far end free. Named the way `remove-wall` takes it — room, side, and
 * how far along the side it hangs.
 */
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

/** Takes a stub out; a wall with both ends attached is not one, and says so. */
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

/** What `resize-wall` is asked for a stub pulled to a length. */
function stubResizeArgs(wall: Wall, length: number) {
  const found = stubOf(wall)
  if (!found) return undefined
  const rounded = Math.max(10, Math.round(length / 10) * 10)
  if (rounded === found.stub.length) return undefined
  return { room: found.room.name, side: found.side, along: found.stub.along, length: rounded }
}

/** Makes a stub another length. */
export function resizeStub(wall: Wall, length: number): boolean {
  const args = stubResizeArgs(wall, length)
  if (!args) return stubOf(wall) !== undefined
  return runEdit(() => documentStore.getState().apply(resizeWall, args))
}

/** Shows the stub at the length it is being pulled to — and the room it would close. */
export function previewStubResize(wall: Wall, length: number): void {
  const args = stubResizeArgs(wall, length)
  if (!args) {
    endPreview()
    return
  }
  previewCommand(resizeWall, args)
}
