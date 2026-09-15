import { StairFlightSchema, StairRunSchema } from '@houseit/core/stair-flight'
import { treadsOf } from '@houseit/core/stairs'
import { containsPoint, roomsOf } from '@houseit/geometry/rooms'
import { stairRise } from '@houseit/geometry/stair-runs'
import { z } from 'zod'
import { allocateId } from './allocate-id'
import { CommandError } from './command-error'
import { defineCommand } from './define-command'
import { json } from './json-schema'
import { length } from './length-schema'
import { levelOf } from './resolve'

export const addStair = defineCommand({
  name: 'add-stair',
  summary:
    'Place measured stair flights from --level up to --to. --flights JSON gives each lower-end centre x,y, uphill direction, clear width, going, risers, and landing outline (except final flight). Riser height follows the two floors. --base-offset adjusts the first floor locally.',
  args: z.object({
    level: z.string().optional(),
    to: z.string(),
    flights: json(z.array(StairFlightSchema)),
    baseOffset: z.coerce.number().int().optional(),
    thickness: length(),
    colour: z.string(),
  }),
  run: (draft, args, open) => {
    const level = levelOf(draft, args.level ?? open, 'add-stair')
    const to = levelOf(draft, args.to, 'add-stair')
    const base = draft.levels[level]!,
      top = draft.levels[to]!
    const next = Object.values(draft.levels)
      .filter((l) => l.elevation > base.elevation)
      .sort((a, b) => a.elevation - b.elevation)[0]
    if (next?.id !== to) throw new CommandError('stairs must reach the next storey above')
    const all = Object.fromEntries(
      Object.values(draft.levels).flatMap((l) => (l.stairs ?? []).map((s) => [s.id, s])),
    )
    const stair = StairRunSchema.parse({ ...args, to, id: allocateId(all, 'stair') })
    const rise = stairRise(draft, level, stair)
    if (rise < 100 || rise > 220)
      throw new CommandError(
        `stair riser is ${rise.toFixed(1)} mm; check the floor levels and riser count`,
      )
    const rooms = roomsOf(draft, level)
    for (const tread of treadsOf(stair)) {
      if (
        !rooms.some((room) =>
          tread.outline.every((p) =>
            containsPoint(
              room.nodes.map((id) => draft.nodes[id]!),
              p.x,
              p.y,
            ),
          ),
        )
      )
        throw new CommandError('stair tread or landing leaves its enclosing room')
    }
    const end = stair.flights.at(-1)!
    const dx = end.direction === 'east' ? 1 : end.direction === 'west' ? -1 : 0
    const dy = end.direction === 'north' ? 1 : end.direction === 'south' ? -1 : 0
    const arrival = {
      x: end.x + dx * ((end.risers - 1) * end.going + 100),
      y: end.y + dy * ((end.risers - 1) * end.going + 100),
    }
    if (
      !roomsOf(draft, top.id).some((room) =>
        containsPoint(
          room.nodes.map((id) => draft.nodes[id]!),
          arrival.x,
          arrival.y,
        ),
      )
    )
      throw new CommandError('stair must arrive on the destination floor')
    base.stairs ??= []
    base.stairs.push(stair)
    return { changed: [stair.id], at: level }
  },
})
export const removeStair = defineCommand({
  name: 'remove-stair',
  summary: 'Remove measured stair flights by id and restore their floor opening.',
  args: z.object({ id: z.string() }),
  run: (draft, args) => {
    const level = Object.values(draft.levels).find((l) => l.stairs?.some((s) => s.id === args.id))
    if (!level) throw new CommandError(`no stair ${args.id}`)
    level.stairs = level.stairs!.filter((s) => s.id !== args.id)
    return { changed: [args.id], at: level.id }
  },
})
