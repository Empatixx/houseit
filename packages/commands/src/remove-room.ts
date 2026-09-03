import type { HouseObject } from '@houseit/core/document'
import { boundaryWallsOf } from '@houseit/geometry/boundary'
import { roomsOf } from '@houseit/geometry/rooms'
import { SIDES, sideRun, sideRuns } from '@houseit/geometry/sides'
import { standingAt } from '@houseit/geometry/standing'
import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { deleteWall, straighten } from './graph'
import { levelOf, roomNamed } from './resolve'
import { standingProblem } from './standing-check'

/**
 * Takes a room out by knocking it through into the room next door: the walls
 * between them go, with the doors and windows in them, and what stood in
 * either room stays where it stood, now in the one room. The other room keeps
 * its name and its floor. A room that shares no wall with the one named
 * cannot be knocked into it.
 */
export const removeRoom = defineCommand({
  name: 'remove-room',
  summary: 'Knock a room through into the room next door',
  args: z.object({
    room: z.string().min(1),
    /** The neighbour it becomes part of. */
    into: z.string().min(1),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'remove-room')
    const room = roomNamed(draft, level, args.room, 'remove-room')
    const into = roomNamed(draft, level, args.into, 'remove-room')
    if (room.id === into.id) {
      throw new CommandError('remove-room: a room cannot be knocked into itself')
    }

    const mine = new Set(boundaryWallsOf(draft, level, room).map((wall) => wall.id))
    const shared = boundaryWallsOf(draft, level, into).filter((wall) => mine.has(wall.id))
    if (shared.length === 0) {
      throw new CommandError(`remove-room: ${room.name} and ${into.name} share no wall`)
    }

    // Where everything in both rooms stands now, before the wall goes, and
    // where the wall each thing backs onto lies — to know afterwards whether
    // that wall is still there. Both rooms: a nightstand against the wall
    // that goes is in the same case as the rack on the other side of it.
    const standing = [room, into].flatMap((where) =>
      Object.values(draft.objects)
        .filter((object) => object.room === where.id)
        .map((object) => {
          const run = object.against
            ? sideRun(draft, level, where, object.against, object.againstNth)
            : undefined
          const offset = object.against && run ? run.from[SIDES[object.against].axis] : undefined
          return { object, spot: standingAt(draft, level, where, object), offset, from: where.name }
        }),
    )

    const ends = new Set(shared.flatMap((wall) => [wall.a, wall.b]))
    for (const wall of shared) deleteWall(draft, level, wall.id)
    for (const node of ends) {
      if (draft.nodes[node]) straighten(draft, level, node)
    }
    delete draft.rooms[room.id]

    // The merged room, found again by the neighbour's anchor.
    const merged = roomsOf(draft, level).find((candidate) => candidate.id === into.id)
    if (!merged) {
      throw new CommandError(`remove-room: ${into.name} was lost in the knocking through`)
    }
    const xs = merged.nodes.map((id) => draft.nodes[id]?.x ?? 0)
    const ys = merged.nodes.map((id) => draft.nodes[id]?.y ?? 0)
    const low = Math.min(...xs)
    const south = Math.min(...ys)
    const width = Math.max(1, Math.max(...xs) - low)
    const depth = Math.max(1, Math.max(...ys) - south)

    for (const { object, spot, offset } of standing) {
      const target = draft.objects[object.id] as HouseObject
      target.room = into.id
      if (!spot) continue

      // Against a wall that is still there, it stays against it, at the same
      // place along the merged room's side. Against the wall that has gone —
      // or one the merged room no longer counts as its side — it stands free,
      // at the very place it stood.
      // The run in the same line as the wall it backed onto, and behind it —
      // not one further along that line, past where the wall stopped.
      const runs = target.against ? sideRuns(draft, level, merged, target.against) : []
      const behind = runs
        .filter((candidate) => candidate.from[SIDES[target.against!].axis] === offset)
        .map((run) => {
          const unit = {
            x: (run.to.x - run.from.x) / (run.length || 1),
            y: (run.to.y - run.from.y) / (run.length || 1),
          }
          const along =
            ((spot.at.x - run.from.x) * unit.x + (spot.at.y - run.from.y) * unit.y) /
            (run.length || 1)
          return { run, along }
        })
        .find(({ run, along }) => run.length > 0 && along >= -0.01 && along <= 1.01)
      if (behind) {
        target.along = Math.round(Math.min(1, Math.max(0, behind.along)) * 1000) / 1000
        if (runs.length > 1) target.againstNth = behind.run.nth
        else delete target.againstNth
      } else {
        delete target.against
        delete target.againstNth
        target.along = Math.round(((spot.at.x - low) / width) * 1000) / 1000
        target.across = Math.round(((spot.at.y - south) / depth) * 1000) / 1000
      }
    }

    // Only once everything stands in the words of the merged room is anything
    // checked: a nightstand still said in the old room's words stands
    // somewhere else entirely, and would be in the way of nothing real.
    for (const { object, from } of standing) {
      const target = draft.objects[object.id] as HouseObject
      const problem = standingProblem(
        draft,
        level,
        merged,
        {
          ...(target.against ? { against: target.against } : {}),
          ...(target.againstNth !== undefined ? { againstNth: target.againstNth } : {}),
          along: target.along,
          ...(target.across !== undefined ? { across: target.across } : {}),
        },
        target,
        target.id,
      )
      if (problem) {
        throw new CommandError(
          `remove-room: the ${object.type} from ${from} cannot stay: ${problem}`,
        )
      }
    }
  },
})
