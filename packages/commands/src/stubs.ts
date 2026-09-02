import type { HouseDocument, Side, Wall } from '@houseit/core/document'
import type { Room } from '@houseit/geometry/rooms'
import { SIDES, sideRun } from '@houseit/geometry/sides'
import type { Draft } from 'immer'
import { CommandError } from './command-error'
import { wallsAt } from './graph'

/**
 * Naming a wall stub: a wall with a free end, hanging off one side of a room
 * this far along it. That is the one kind of wall that can be taken out or
 * made longer on its own — a wall with both ends attached bounds rooms, and
 * goes only with the room it bounds.
 */

export type Stub = {
  wall: Wall
  /** The node on the side it hangs from. */
  root: string
  /** The node standing free in the room. */
  tip: string
  /** Where along the side its root is, 0 west or south and 1 the other end. */
  along: number
  length: number
}

/** The stubs hanging off one side of a room, by where they hang. */
export function stubsOn(
  doc: HouseDocument | Draft<HouseDocument>,
  level: string,
  room: Room,
  side: Side,
): Stub[] {
  const run = sideRun(doc, level, room, side)
  if (!run || run.length === 0) return []
  const { axis } = SIDES[side]
  const line = run.from[axis]
  const unit = { x: (run.to.x - run.from.x) / run.length, y: (run.to.y - run.from.y) / run.length }

  const stubs: Stub[] = []
  for (const wall of Object.values(doc.walls)) {
    if (wall.level !== level) continue
    const a = doc.nodes[wall.a]
    const b = doc.nodes[wall.b]
    if (!a || !b) continue
    // A stub runs across the side, from a node on the side's line to a free end.
    const ends = [
      { id: wall.a, point: a },
      { id: wall.b, point: b },
    ]
    const root = ends.find((end) => end.point[axis] === line)
    const tip = ends.find((end) => end !== root)
    if (!root || !tip) continue
    if (tip.point[axis] === line) continue
    if (wallsAt(doc, level, tip.id).length !== 1) continue
    const along =
      ((root.point.x - run.from.x) * unit.x + (root.point.y - run.from.y) * unit.y) / run.length
    if (along < -0.01 || along > 1.01) continue
    stubs.push({
      wall: wall as Wall,
      root: root.id,
      tip: tip.id,
      along: Math.round(Math.min(1, Math.max(0, along)) * 1000) / 1000,
      length: Math.abs(tip.point[axis] - root.point[axis]),
    })
  }
  return stubs.sort((one, other) => one.along - other.along)
}

/** The stub a command means: the one nearest to `along` on that side, within a hand's breadth. */
export function stubNamed(
  doc: HouseDocument | Draft<HouseDocument>,
  level: string,
  room: Room,
  side: Side,
  along: number,
  what: string,
): Stub {
  const stubs = stubsOn(doc, level, room, side)
  const found = stubs
    .map((stub) => ({ stub, off: Math.abs(stub.along - along) }))
    .filter(({ off }) => off <= 0.05)
    .sort((one, other) => one.off - other.off)[0]
  if (found) return found.stub
  if (stubs.length === 0) {
    throw new CommandError(`${what}: no wall stub hangs off the ${side} side of ${room.name}`)
  }
  throw new CommandError(
    `${what}: no wall stub at ${along} along the ${side} side of ${room.name} — there is one at ${stubs.map((stub) => stub.along).join(', ')}`,
  )
}
