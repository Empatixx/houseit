import type { HouseDocument, Side } from '@houseit/core/document'
import type { Point } from '@houseit/geometry/outlines'
import { roomsOf } from '@houseit/geometry/rooms'
import { SIDES, sideRun, wallsOnSide } from '@houseit/geometry/sides'
import { standingAt } from '@houseit/geometry/standing'
import type { Draft } from 'immer'
import { z } from 'zod'
import { allocateId } from './allocate-id'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { wallsAt } from './graph'
import { length } from './length-schema'
import { levelOf, roomNamed, SIDE_NAMES, sideNamed } from './resolve'
import { standingProblem } from './standing-check'

const LEAST = 300

export const moveWall = defineCommand({
  name: 'move-wall',
  summary: 'Move the wall on one side of a room, outward by a length or inward by a minus one',
  args: z.object({
    room: z.string().min(1),
    side: z.enum(SIDE_NAMES).optional(),
    wall: z.string().min(1).optional(),
    by: length(),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'move-wall')
    const room = roomNamed(draft, level, args.room, 'move-wall')
    if (args.by === 0) return { changed: [room.id] }

    const at = sideNamed(draft, level, room, args, 'move-wall')
    const walls = wallsOnSide(draft, level, room, at.side, at.nth)
    if (walls.length === 0) {
      throw new CommandError(`move-wall: ${room.name} has no wall facing ${at.side}`)
    }
    const { axis, low } = SIDES[at.side]
    const across = axis === 'x' ? 'y' : 'x'
    const outward = low ? -1 : 1
    const shift = args.by * outward

    const { moving, steps } =
      at.wall === undefined
        ? { moving: wholeSide(draft, level, walls, axis), steps: [] }
        : onlyWall(draft, level, at.wall, axis)

    const stretching = Object.values(draft.walls).filter(
      (wall) => wall.level === level && moving.has(wall.a) !== moving.has(wall.b),
    )
    const squashed: string[] = []
    for (const wall of stretching) {
      const fixed = draft.nodes[moving.has(wall.a) ? wall.b : wall.a]!
      const moved = draft.nodes[moving.has(wall.a) ? wall.a : wall.b]!
      const before = moved[axis] - fixed[axis]
      const after = before + shift
      if (after === 0) {
        const opening = Object.values(draft.openings).find((it) => it.wall === wall.id)
        if (opening) {
          throw new CommandError(
            `move-wall: the ${opening.kind} in the wall at ${fixed[across]} would be squashed to nothing`,
          )
        }
        squashed.push(wall.id)
        continue
      }
      if (Math.sign(after) !== Math.sign(before) || Math.abs(after) < LEAST) {
        throw new CommandError(
          `move-wall: ${Math.abs(args.by)} mm ${args.by > 0 ? 'outward' : 'inward'} would leave the wall at ${fixed[across]} on the ${at.side} side ${Math.abs(after)} mm long`,
        )
      }
    }

    const wasFine = standingReport(draft, level)
    const stood = standingBefore(draft, level, moving, axis)

    for (const wall of stretching) {
      if (squashed.includes(wall.id)) continue
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

    for (const step of steps) {
      const id = allocateId(draft.walls, 'w')
      const like = draft.walls[step.like]!
      draft.walls[id] = {
        id,
        level,
        a: step.from,
        b: step.to,
        thickness: like.thickness,
        baseOffset: like.baseOffset,
        height: like.height,
      }
    }

    for (const id of squashed) collapse(draft, level, id)

    standStill(draft, level, stood, axis, shift)

    const problem = standingReport(draft, level).find(
      (it) => !wasFine.some((was) => was.object === it.object && was.problem === it.problem),
    )
    if (problem) {
      throw new CommandError(`move-wall: ${problem.problem}`)
    }

    return {
      changed: roomsOf(draft, level)
        .filter((face) => face.id !== undefined && face.nodes.some((node) => moving.has(node)))
        .map((face) => face.id!),
    }
  },
})

type Step = { from: string; to: string; like: string }

function collapse(draft: Draft<HouseDocument>, level: string, id: string): void {
  const wall = draft.walls[id]
  if (!wall) return
  const { a, b } = wall
  delete draft.walls[id]
  for (const other of Object.values(draft.walls)) {
    if (other.level !== level) continue
    if (other.a === b) other.a = a
    if (other.b === b) other.b = a
  }
  if (!Object.values(draft.walls).some((other) => other.a === b || other.b === b)) {
    delete draft.nodes[b]
  }
}

function wholeSide(
  draft: Draft<HouseDocument>,
  level: string,
  walls: { wall: string }[],
  axis: 'x' | 'y',
): Set<string> {
  const moving = new Set<string>()
  const queue = walls.flatMap((wall) => [draft.walls[wall.wall]!.a, draft.walls[wall.wall]!.b])
  while (queue.length > 0) {
    const node = queue.pop()!
    if (moving.has(node)) continue
    moving.add(node)
    for (const wall of wallsAt(draft, level, node)) {
      const other = wall.a === node ? wall.b : wall.a
      if (draft.nodes[node]![axis] === draft.nodes[other]![axis]) queue.push(other)
    }
  }
  return moving
}

function onlyWall(
  draft: Draft<HouseDocument>,
  level: string,
  id: string,
  axis: 'x' | 'y',
): { moving: Set<string>; steps: Step[] } {
  const wall = draft.walls[id]!
  const moving = new Set<string>()
  const steps: Step[] = []

  for (const node of [wall.a, wall.b]) {
    const alongside = wallsAt(draft, level, node).some(
      (other) => other.id !== id && draft.nodes[other.a]![axis] === draft.nodes[other.b]![axis],
    )
    if (!alongside) {
      moving.add(node)
      continue
    }
    const made = allocateId(draft.nodes, 'n')
    const here = draft.nodes[node]!
    draft.nodes[made] = { id: made, x: here.x, y: here.y }
    if (wall.a === node) wall.a = made
    else wall.b = made
    moving.add(made)
    steps.push({ from: node, to: made, like: id })
  }

  return { moving, steps }
}

type Stood = { object: string; room: string; at: Point; withWall: boolean }

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
        const run = sideRun(draft, level, room, object.against)
        withWall =
          run !== undefined && SIDES[object.against].axis === axis && run.from[axis] === line
      }
      out.push({ object: object.id, room: room.id, at: spot.at, withWall })
    }
  }
  return out
}

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
