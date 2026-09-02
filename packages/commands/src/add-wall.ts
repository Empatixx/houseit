import { FLOOR_MATERIAL_IDS } from '@houseit/core/floor-materials'
import { anchorInside } from '@houseit/geometry/anchor'
import { type Room, roomsOf } from '@houseit/geometry/rooms'
import { sideRun } from '@houseit/geometry/sides'
import { z } from 'zod'
import { allocateId } from './allocate-id'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { length } from './length-schema'
import { wallInto } from './partition'
import { levelOf, roomNamed } from './resolve'

const PARTITION_THICKNESS = 150

/**
 * Puts a wall into a room from one of its sides: this far along the side, and
 * into the room as far as `--length`, or right across to the far wall if no
 * length is said.
 *
 * Right across, the room comes apart in two, and the part without the old
 * name gets `--name` — or the old name numbered. Short of the far wall, the
 * wall stands with a free end: a stub, which makes a nook, an alcove, the arm
 * of a T. Two stubs meeting end to end close a room between them, and that
 * room gets a name too. This is how shapes are made that no cut off a side or
 * out of a corner would make.
 */
export const addWall = defineCommand({
  name: 'add-wall',
  summary: 'Put a wall into a room from one side: right across, or a stub of a length',
  args: z.object({
    room: z.string().min(1),
    side: z.enum(['north', 'south', 'east', 'west']),
    /** Where along that side it starts, 0 west or south and 1 the other end. */
    along: z.coerce.number().min(0).max(1),
    /** How far into the room; left out, it goes to the far wall. */
    length: length().optional(),
    /** What to call a room the wall closes off. Left out, the old name numbered. */
    name: z.string().min(1).optional(),
    material: z.enum(FLOOR_MATERIAL_IDS as [string, ...string[]]).optional(),
    thickness: length().default(PARTITION_THICKNESS),
    level: z.string().optional(),
  }),
  run: (draft, args) => {
    const level = levelOf(draft, args.level, 'add-wall')
    const room = roomNamed(draft, level, args.room, 'add-wall')
    const run = sideRun(draft, level, room, args.side)
    if (!run) throw new CommandError(`add-wall: ${room.name} has no wall facing ${args.side}`)

    const from = {
      x: Math.round(run.from.x + (run.to.x - run.from.x) * args.along),
      y: Math.round(run.from.y + (run.to.y - run.from.y) * args.along),
    }
    const before = new Set(roomsOf(draft, level).map(keyOf))
    wallInto(draft, level, room, from, run.inward, args.length, args.thickness, 'add-wall')
    nameNewFaces(draft, level, room, before, args.name, args.material)
  },
})

const keyOf = (room: Room) => [...room.nodes].sort().join('-')

/**
 * Whatever faces the wall closed off get records: the one holding the old
 * anchor keeps the old name; the rest are named as asked, or after it.
 */
function nameNewFaces(
  draft: Parameters<typeof roomsOf>[0],
  level: string,
  source: Room,
  before: Set<string>,
  name: string | undefined,
  material: string | undefined,
): void {
  const fresh = roomsOf(draft, level).filter((face) => !face.id && !before.has(keyOf(face)))
  const taken = new Set(Object.values(draft.rooms).map((record) => record.name))
  fresh.forEach((face, index) => {
    let chosen = name ?? `${source.name ?? 'room'} 2`
    if (index > 0 || taken.has(chosen)) {
      let n = 2
      const base = name ?? source.name ?? 'room'
      while (taken.has(`${base} ${n}`)) n += 1
      chosen = `${base} ${n}`
    }
    taken.add(chosen)
    const id = allocateId(draft.rooms, 'r')
    const anchor = anchorInside(
      face.nodes.map((node) => draft.nodes[node]!),
      face.area,
    )
    draft.rooms[id] = { id, level, ...anchor, name: chosen, floor: material ?? source.floor }
  })
}
