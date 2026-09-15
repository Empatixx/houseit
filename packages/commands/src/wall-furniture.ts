import type { HouseDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { sideRun } from '@houseit/geometry/sides'
import { standingAt } from '@houseit/geometry/standing'
import { CommandError } from './command-error'
import { standingProblem } from './standing-check'

export function furnitureBefore(doc: HouseDocument, level: string) {
  const rooms = new Map(roomsOf(doc, level).map((room) => [room.id, room]))
  return Object.values(doc.objects)
    .filter((o) => o.level === level)
    .map((object) => {
      const room = rooms.get(object.room)
      const spot = room && standingAt(doc, level, room, object)
      return {
        id: object.id,
        at: spot?.at,
        problem: room ? standingProblem(doc, level, room, object, object, object.id) : undefined,
      }
    })
}

export function retainFurniture(
  doc: HouseDocument,
  level: string,
  before: ReturnType<typeof furnitureBefore>,
) {
  const rooms = new Map(roomsOf(doc, level).map((room) => [room.id, room]))
  for (const was of before) {
    const object = doc.objects[was.id]
    if (!object || !was.at) continue
    const room = rooms.get(object.room)
    if (!room) throw new CommandError(`update-wall: ${was.id} would lose its room`)
    if (object.against) {
      const run = sideRun(doc, level, room, object.against, object.againstNth)
      if (!run || run.length === 0)
        throw new CommandError(`update-wall: ${was.id} would lose its supporting wall`)
      object.along =
        ((was.at.x - run.from.x) * (run.to.x - run.from.x) +
          (was.at.y - run.from.y) * (run.to.y - run.from.y)) /
        (run.length * run.length)
    } else {
      const points = room.nodes.map((id) => doc.nodes[id]!)
      const x0 = Math.min(...points.map((p) => p.x)),
        x1 = Math.max(...points.map((p) => p.x))
      const y0 = Math.min(...points.map((p) => p.y)),
        y1 = Math.max(...points.map((p) => p.y))
      object.along = (was.at.x - x0) / (x1 - x0)
      object.across = (was.at.y - y0) / (y1 - y0)
    }
    if (
      object.along < 0 ||
      object.along > 1 ||
      (object.across !== undefined && (object.across < 0 || object.across > 1))
    )
      throw new CommandError(`update-wall: ${was.id} would no longer fit its room`)
  }
  for (const was of before) {
    const object = doc.objects[was.id]
    if (!object) continue
    const room = rooms.get(object.room)
    if (!room) continue
    const problem = standingProblem(doc, level, room, object, object, object.id)
    if (problem && problem !== was.problem)
      throw new CommandError(`update-wall: ${was.id}: ${problem}`)
  }
}
