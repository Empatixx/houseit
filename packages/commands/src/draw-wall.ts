import type { Side } from '@houseit/core/document'
import { FLOOR_MATERIAL_IDS } from '@houseit/core/floor-materials'
import { anchorInside } from '@houseit/geometry/anchor'
import type { Point } from '@houseit/geometry/outlines'
import { containsPoint, type Room, roomsOf } from '@houseit/geometry/rooms'
import { sideRun } from '@houseit/geometry/sides'
import { z } from 'zod'
import { allocateId } from './allocate-id'
import { type Along, along, alongSide } from './along-schema'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { parseLength } from './length'
import { length } from './length-schema'
import { parseWalk } from './parse-walk'
import { linkPoints, nearWall } from './partition'
import { levelOf, roomNamed, SIDE_NAMES, sideNamed } from './resolve'

const PARTITION_THICKNESS = 150

const HEADINGS = { n: { x: 0, y: 1 }, s: { x: 0, y: -1 }, e: { x: 1, y: 0 }, w: { x: -1, y: 0 } }

export const drawWall = defineCommand({
  name: 'draw-wall',
  summary: 'Draw walls as a walk of legs from a point: on a side of a room, or on the paper',
  args: z.object({
    walk: z.string().min(1),
    room: z.string().min(1).optional(),
    side: z.enum(SIDE_NAMES).optional(),
    wall: z.string().min(1).optional(),
    along: along().optional(),
    at: z.string().optional(),
    name: z.string().min(1).optional(),
    material: z.enum(FLOOR_MATERIAL_IDS as [string, ...string[]]).optional(),
    thickness: length().default(PARTITION_THICKNESS),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'draw-wall')
    const start = startOf(draft, level, args)
    const legs = parseWalk(args.walk)

    const before = new Set(roomsOf(draft, level).map(keyOf))
    const inRoom = roomsOf(draft, level).find((room) =>
      containsPoint(
        room.nodes.map((id) => draft.nodes[id]!),
        start.x,
        start.y,
      ),
    )

    let from = start
    let drew = false
    for (const leg of legs) {
      const step = HEADINGS[leg.heading]
      let to = { x: from.x + step.x * leg.length, y: from.y + step.y * leg.length }
      to = nearWall(draft, level, to) ?? to
      try {
        linkPoints(draft, level, from, to, args.thickness, 'draw-wall')
        drew = true
      } catch (error) {
        if (!(error instanceof CommandError)) throw error
      }
      from = to
    }
    if (!drew) throw new CommandError('draw-wall: there are walls there already')

    nameNewFaces(draft, level, before, args.name, args.material ?? inRoom?.floor)
  },
})

function startOf(
  draft: Parameters<typeof roomsOf>[0],
  level: string,
  args: { room?: string; side?: Side; wall?: string; along?: Along; at?: string },
): Point {
  if (args.at !== undefined) {
    const parts = args.at.split(',').map((part) => part.trim())
    if (parts.length !== 2) throw new CommandError('draw-wall: --at wants "x,y"')
    return { x: parseLength(parts[0]!), y: parseLength(parts[1]!) }
  }
  if (args.room === undefined || args.along === undefined) {
    throw new CommandError(
      'draw-wall: say where to start — --at x,y, or --room, --side or --wall, and --along',
    )
  }
  const room = roomNamed(draft, level, args.room, 'draw-wall')
  const at = sideNamed(draft, level, room, args, 'draw-wall')
  const run = sideRun(draft, level, room, at.side, at.nth)
  if (!run) throw new CommandError(`draw-wall: ${room.name} has no wall facing ${at.side}`)
  const fraction = alongSide(draft, level, room, at, args.along, 'draw-wall')
  return {
    x: Math.round(run.from.x + (run.to.x - run.from.x) * fraction),
    y: Math.round(run.from.y + (run.to.y - run.from.y) * fraction),
  }
}

const keyOf = (room: Room) => [...room.nodes].sort().join('-')

function nameNewFaces(
  draft: Parameters<typeof roomsOf>[0],
  level: string,
  before: Set<string>,
  name: string | undefined,
  material: string | undefined,
): void {
  const fresh = roomsOf(draft, level).filter((face) => !face.id && !before.has(keyOf(face)))
  const taken = new Set(Object.values(draft.rooms).map((record) => record.name))
  fresh.forEach((face, index) => {
    const base = name ?? 'room'
    let chosen = base
    let n = 2
    while (taken.has(chosen) || index > 0) {
      chosen = `${base} ${n}`
      n += 1
      if (!taken.has(chosen) && index === 0) break
      if (!taken.has(chosen) && index > 0) break
    }
    taken.add(chosen)
    const id = allocateId(draft.rooms, 'r')
    const anchor = anchorInside(
      face.nodes.map((node) => draft.nodes[node]!),
      face.area,
    )
    draft.rooms[id] = {
      id,
      level,
      ...anchor,
      name: chosen,
      ...(material ? { floor: material } : {}),
    }
  })
}
