import type { HouseDocument, Side } from '@houseit/core/document'
import { anchorInside } from '@houseit/geometry/anchor'
import type { Point } from '@houseit/geometry/outlines'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { SIDES, sideRun, wallsOnSide } from '@houseit/geometry/sides'
import { standingAt } from '@houseit/geometry/standing'
import type { Draft } from 'immer'
import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { wallsAt } from './graph'
import { length } from './length-schema'
import { levelOf, roomNamed, SIDE_NAMES, sideNamed } from './resolve'
import { standingProblem } from './standing-check'

/** A wall shorter than this is not a wall anybody can build. */
const LEAST = 300

/**
 * Moves a wall of a room: the whole line of it, so the walls that carry on
 * from its ends stay straight, and the walls that meet it end to end stretch
 * or shorten to follow. Outward makes the room bigger; a minus makes it
 * smaller, and the room on the other side the opposite.
 *
 * The doors and windows in the moved walls go with them. The ones in the
 * walls that stretch stay where they were from their far end, which is the
 * end that did not move. Whatever stands in the rooms around is checked
 * afterwards, and the move is refused if it would leave something in a wall.
 */
export const moveWall = defineCommand({
  name: 'move-wall',
  summary: 'Move the wall on one side of a room, outward by a length or inward by a minus one',
  args: z.object({
    room: z.string().min(1),
    /** The side to move; or the very wall by its id from describe, for an L's second wall on a side. */
    side: z.enum(SIDE_NAMES).optional(),
    wall: z.string().min(1).optional(),
    /** How far, outward; a minus is inward. `-300`, `0.5m`. */
    by: length(),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'move-wall')
    const room = roomNamed(draft, level, args.room, 'move-wall')
    if (args.by === 0) return

    const at = sideNamed(draft, level, room, args, 'move-wall')
    const walls = wallsOnSide(draft, level, room, at.side, at.nth)
    if (walls.length === 0) {
      throw new CommandError(`move-wall: ${room.name} has no wall facing ${at.side}`)
    }
    const { axis, low } = SIDES[at.side]
    const across = axis === 'x' ? 'y' : 'x'
    const outward = low ? -1 : 1
    const shift = args.by * outward

    // The whole line: every node reached from the wall's ends along walls that
    // run the same way.
    const moving = new Set<string>()
    const queue = walls.flatMap((wall) => [draft.walls[wall.wall]!.a, draft.walls[wall.wall]!.b])
    while (queue.length > 0) {
      const node = queue.pop()!
      if (moving.has(node)) continue
      moving.add(node)
      for (const wall of wallsAt(draft, level, node)) {
        const other = wall.a === node ? wall.b : wall.a
        const here = draft.nodes[node]!
        const there = draft.nodes[other]!
        if (here[axis] === there[axis]) queue.push(other)
      }
    }

    // The walls that meet the line end on: they stretch or shorten, and nothing
    // may shorten to nothing or turn inside out.
    const stretching = Object.values(draft.walls).filter(
      (wall) => wall.level === level && moving.has(wall.a) !== moving.has(wall.b),
    )
    for (const wall of stretching) {
      const fixed = draft.nodes[moving.has(wall.a) ? wall.b : wall.a]!
      const moved = draft.nodes[moving.has(wall.a) ? wall.a : wall.b]!
      const before = moved[axis] - fixed[axis]
      const after = before + shift
      if (Math.sign(after) !== Math.sign(before) || Math.abs(after) < LEAST) {
        throw new CommandError(
          `move-wall: ${Math.abs(args.by)} mm ${args.by > 0 ? 'outward' : 'inward'} would leave the wall at ${fixed[across]} on the ${at.side} side ${Math.abs(after)} mm long`,
        )
      }
    }

    const before = footing(draft, level)
    const wasFine = standingReport(draft, level)
    const stood = standingBefore(draft, level, moving, axis)

    // Openings in the stretching walls keep their distance from the fixed end.
    for (const wall of stretching) {
      const aMoves = moving.has(wall.a)
      const fixed = draft.nodes[aMoves ? wall.b : wall.a]!
      const moved = draft.nodes[aMoves ? wall.a : wall.b]!
      const oldLength = Math.abs(moved[axis] - fixed[axis])
      const newLength = Math.abs(moved[axis] + shift - fixed[axis])
      for (const opening of Object.values(draft.openings)) {
        if (opening.wall !== wall.id) continue
        const fromFixed = (aMoves ? 1 - opening.t : opening.t) * oldLength
        if (fromFixed + opening.width / 2 > newLength) {
          throw new CommandError(
            `move-wall: the ${opening.kind} in the wall at ${fixed[across]} would be pushed off its end`,
          )
        }
        opening.t = aMoves ? 1 - fromFixed / newLength : fromFixed / newLength
      }
    }

    for (const node of moving) draft.nodes[node]![axis] += shift

    // Every room keeps the face it had, by the nodes that make it, and is
    // anchored in the middle of it again — a room shrunk past its anchor would
    // otherwise wake up as its neighbour.
    reanchor(draft, level, before)

    // What stood in the rooms round the wall stays where it stood, unless it
    // stood against the wall that moved — then it goes with it. A sofa against
    // the east wall does not slide south because the north wall came down.
    standStill(draft, level, stood, axis, shift)

    const problem = standingReport(draft, level).find(
      (it) => !wasFine.some((was) => was.object === it.object && was.problem === it.problem),
    )
    if (problem) {
      throw new CommandError(`move-wall: ${problem.problem}`)
    }
  },
})

type Stood = { object: string; room: string; at: Point; withWall: boolean }

/**
 * Where everything stands in the rooms the moving nodes bound, and whether it
 * stands against a wall that is about to move — the wall it backs onto lies on
 * the moving line if its run is at the same place across as the moving nodes.
 */
function standingBefore(
  draft: Draft<HouseDocument>,
  level: string,
  moving: Set<string>,
  axis: 'x' | 'y',
): Stood[] {
  const out: Stood[] = []
  const [first] = moving
  const line = first === undefined ? undefined : draft.nodes[first]?.[axis]
  for (const room of roomsOf(draft, level)) {
    if (!room.id || !room.nodes.some((node) => moving.has(node))) continue
    for (const object of Object.values(draft.objects)) {
      if (object.room !== room.id || object.level !== level) continue
      const spot = standingAt(draft, level, room, object)
      if (!spot) continue
      let withWall = false
      if (object.against) {
        // Its wall is the moving one if it runs across the moving axis at the line's offset.
        const run = sideRun(draft, level, room, object.against)
        withWall =
          run !== undefined && SIDES[object.against].axis === axis && run.from[axis] === line
      }
      out.push({ object: object.id, room: room.id, at: spot.at, withWall })
    }
  }
  return out
}

/** Puts each thing back where it stood, in the words of the room as it now is. */
function standStill(
  draft: Draft<HouseDocument>,
  level: string,
  stood: Stood[],
  axis: 'x' | 'y',
  shift: number,
): void {
  const rooms = new Map(roomsOf(draft, level).map((room) => [room.id, room] as const))
  for (const was of stood) {
    const object = draft.objects[was.object]
    const room = rooms.get(was.room)
    if (!object || !room) continue
    const at = was.withWall ? { ...was.at, [axis]: was.at[axis] + shift } : was.at
    if (object.against) {
      const run = sideRun(draft, level, room, object.against)
      if (!run || run.length === 0) continue
      const unit = {
        x: (run.to.x - run.from.x) / run.length,
        y: (run.to.y - run.from.y) / run.length,
      }
      const along = ((at.x - run.from.x) * unit.x + (at.y - run.from.y) * unit.y) / run.length
      object.along = Math.round(Math.min(1, Math.max(0, along)) * 1000) / 1000
      continue
    }
    const xs = room.nodes.map((node) => draft.nodes[node]?.x ?? 0)
    const ys = room.nodes.map((node) => draft.nodes[node]?.y ?? 0)
    const low = Math.min(...xs)
    const south = Math.min(...ys)
    const width = Math.max(1, Math.max(...xs) - low)
    const depth = Math.max(1, Math.max(...ys) - south)
    object.along = Math.round(Math.min(1, Math.max(0, (at.x - low) / width)) * 1000) / 1000
    object.across = Math.round(Math.min(1, Math.max(0, (at.y - south) / depth)) * 1000) / 1000
  }
}

/** Which face each stored room sits in, by the nodes round it, before anything moves. */
function footing(draft: Draft<HouseDocument>, level: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const room of roomsOf(draft, level)) {
    if (room.id) map.set(room.id, keyOf(room))
  }
  return map
}

/** Puts each stored room's anchor at the middle of the face it was in. */
export function reanchor(
  draft: Draft<HouseDocument>,
  level: string,
  footing: Map<string, string>,
): void {
  const faces = new Map(roomsOf(draft, level).map((room) => [keyOf(room), room] as const))
  for (const [id, key] of footing) {
    const face = faces.get(key)
    const record = draft.rooms[id]
    if (!face || !record) continue
    const polygon = face.nodes.map((node) => draft.nodes[node]!)
    const anchor = anchorInside(polygon, face.area)
    record.x = anchor.x
    record.y = anchor.y
  }
}

const keyOf = (room: Room) => [...room.nodes].sort().join('-')

/** What is wrong with where each thing stands, room by room. */
function standingReport(
  draft: Draft<HouseDocument>,
  level: string,
): { object: string; problem: string }[] {
  const out: { object: string; problem: string }[] = []
  for (const room of roomsOf(draft, level)) {
    if (!room.id) continue
    for (const object of Object.values(draft.objects)) {
      if (object.room !== room.id || object.level !== level) continue
      const spot = {
        ...(object.against ? { against: object.against as Side } : {}),
        along: object.along,
        ...(object.across !== undefined ? { across: object.across } : {}),
      }
      const problem = standingProblem(draft, level, room, spot, object, object.id)
      if (problem) {
        out.push({
          object: object.id,
          problem: `the ${object.type} in ${room.name ?? 'a room'} ${problem.replace(/^it /, '')}`,
        })
      }
    }
  }
  return out
}
