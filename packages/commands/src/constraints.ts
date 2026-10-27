import type { HouseDocument } from '@houseit/core/document'
import { z } from 'zod'
import { allocateId } from './allocate-id'
import { CommandError } from './command-error'
import { assertConstraints, measureOf } from './constraint-rules'
import { defineCommand } from './define-command'
import { length } from './length-schema'
import { whereRoom } from './resolve'

export const addConstraint = defineCommand({
  name: 'add-constraint',
  summary:
    "Hold the plan to a rule every later edit must keep: --kind fixed keeps a room's inner --measure width|depth at --length (default: what it is now); --kind equal keeps --room and --other at the same --measure; --kind parallel keeps --wall and --other walls parallel. An edit that would break one is refused and says which",
  args: z.object({
    kind: z.enum(['fixed', 'equal', 'parallel']),
    room: z.string().min(1).optional(),
    other: z.string().min(1).optional(),
    measure: z.enum(['width', 'depth']).optional(),
    length: length().optional(),
    wall: z.string().min(1).optional(),
  }),
  run: (draft, args) => {
    draft.constraints ??= {}
    const constraints = draft.constraints
    const id = allocateId(constraints, 'k')
    const verb = 'add-constraint'
    if (args.kind === 'parallel') {
      if (!args.wall || !args.other)
        throw new CommandError(`${verb}: parallel needs --wall and --other`)
      const elements = new Set(Object.values(draft.walls).map((wall) => wall.element ?? wall.id))
      const element = (given: string) => {
        const found = draft.walls[given]?.element ?? (elements.has(given) ? given : undefined)
        if (!found) throw new CommandError(`${verb}: there is no wall ${given}`)
        return found
      }
      constraints[id] = {
        id,
        kind: 'parallel',
        wall: element(args.wall),
        other: element(args.other),
      }
    } else {
      if (!args.room || !args.measure)
        throw new CommandError(`${verb}: ${args.kind} needs --room and --measure width|depth`)
      const { room } = whereRoom(draft, undefined, args.room, verb)
      if (args.kind === 'fixed') {
        const now = measureOf(draft as HouseDocument, room.id, args.measure)
        const held = args.length ?? now
        if (held === undefined) throw new CommandError(`${verb}: ${args.room} has no closed floor`)
        constraints[id] = { id, kind: 'fixed', room: room.id, measure: args.measure, length: held }
      } else {
        if (!args.other) throw new CommandError(`${verb}: equal needs --other`)
        const other = whereRoom(draft, undefined, args.other, verb).room
        if (other.id === room.id)
          throw new CommandError(`${verb}: a room is always equal to itself`)
        constraints[id] = {
          id,
          kind: 'equal',
          room: room.id,
          other: other.id,
          measure: args.measure,
        }
      }
    }
    assertConstraints(draft)
    const held = constraints[id]!
    const shown =
      held.kind === 'parallel' ? [] : held.kind === 'equal' ? [held.room, held.other] : [held.room]
    return { changed: [id], shown }
  },
})

export const removeConstraint = defineCommand({
  name: 'remove-constraint',
  summary: 'Let go of a rule added with add-constraint, by the id its answer gave',
  args: z.object({ id: z.string().min(1) }),
  run: (draft, args) => {
    if (!draft.constraints?.[args.id])
      throw new CommandError(`remove-constraint: there is no constraint ${args.id}`)
    delete draft.constraints[args.id]
    if (Object.keys(draft.constraints).length === 0) delete draft.constraints
    return { changed: [args.id] }
  },
})
