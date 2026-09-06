import type { HouseObject } from '@houseit/core/document'
import { boundaryWallsOf } from '@houseit/geometry/boundary'
import { roomsOf } from '@houseit/geometry/rooms'
import { SIDES, sideRun, sideRuns } from '@houseit/geometry/sides'
import { standingAt } from '@houseit/geometry/standing'
import { z } from 'zod'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { deleteWall, straighten } from './graph'
import { roomNamed, whereRoom } from './resolve'
import { standingProblem } from './standing-check'

export const removeRoom = defineCommand({
  name: 'remove-room',
  summary: 'Knock a room through into the room next door, or clear the last room off a storey',
  args: z.object({
    room: z.string().min(1),
    into: z.string().min(1).optional(),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const { room, level } = whereRoom(draft, args.level, args.room, 'remove-room')

    if (args.into === undefined) {
      const others = roomsOf(draft, level).filter((other) => other.id !== room.id)
      if (others.length > 0) {
        throw new CommandError(
          `remove-room: say which room ${room.name} is knocked through into — there is still ${others.map((it) => it.name ?? '(unnamed)').join(', ')} on this storey`,
        )
      }
      return clearStorey(draft, level)
    }

    const into = roomNamed(draft, level, args.into, 'remove-room')
    if (room.id === into.id) {
      throw new CommandError('remove-room: a room cannot be knocked into itself')
    }

    const mine = new Set(boundaryWallsOf(draft, level, room).map((wall) => wall.id))
    const shared = boundaryWallsOf(draft, level, into).filter((wall) => mine.has(wall.id))
    if (shared.length === 0) {
      throw new CommandError(`remove-room: ${room.name} and ${into.name} share no wall`)
    }

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
    return { changed: [room.id, into.id] }
  },
})

function clearStorey(draft: Parameters<typeof deleteWall>[0], level: string) {
  const gone: string[] = []
  for (const wall of Object.values(draft.walls)) {
    if (wall.level === level) deleteWall(draft, level, wall.id)
  }
  for (const object of Object.values(draft.objects)) {
    if (object.level === level) {
      gone.push(object.id)
      delete draft.objects[object.id]
    }
  }
  for (const record of Object.values(draft.rooms)) {
    if (record.level === level) {
      gone.push(record.id)
      delete draft.rooms[record.id]
    }
  }
  const held = new Set(Object.values(draft.walls).flatMap((wall) => [wall.a, wall.b]))
  for (const node of Object.keys(draft.nodes)) {
    if (!held.has(node)) delete draft.nodes[node]
  }
  return { changed: gone }
}
