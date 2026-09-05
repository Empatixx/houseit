import type { ExecResult } from '@houseit/bridge/contract'
import { describeCommands } from '@houseit/commands/registry'

/**
 * What the agent reads back.
 *
 * One shape, always: what the script touched, those rooms in full — walls,
 * openings, what stands in them and what stretch of each wall is still free —
 * and everything now wrong with the plan. A command that only asked and a
 * command that changed everything answer the same way, because there is one
 * answer and it is assembled in one place.
 */
export function report(result: ExecResult): string {
  if (!result.ok) return result.error

  // Which plan this was, since the agent works on whichever project is open and
  // did not choose it.
  const plan = result.project?.name ?? 'the plan'
  return `${plan}\n${compactJson(result.answer)}`
}

/**
 * The tool's description, which never changes.
 *
 * Deliberately not the command list. A description is part of the prompt, and a
 * prompt that changes invalidates the cache of every conversation using it — so
 * a new kind of sofa in the catalogue would make every agent everywhere start
 * again from cold. The list is a `help` away instead, and an answer to a call is
 * cached like any other.
 */
export function toolDescription(): string {
  return [
    'Edit the floor plan open in the browser. Takes one or more commands, one per',
    'line, applied as a single transaction — if any line fails, nothing changes.',
    'Lines starting with # are comments. Lengths are in millimetres, or with a unit: 3.6m.',
    '',
    'Call it with `help` on its own for the commands and every option they take.',
    'There are ten: get-plan, and add/update/remove for a room, an opening (a door',
    'or a window) and an object. There is no command for a wall — every wall is the',
    'edge of a room, and add-room draws the ones a room needs.',
    '',
    'Nothing carries a coordinate. A room is cut out of a room; a door goes in a',
    'side of a room; a thing stands against a side and --along it, or --across the',
    'room. --along is a fraction of the wall (0 at its west or south end, 1 at the',
    'other) or a length from that end: 0.5, 2.4m, 2400, -1m for a metre from the',
    'far end. Where a side has two walls, --wall w12 reaches the one you mean.',
    '',
    'Every call answers the same way and comes with a picture of what it did:',
    'the ids it changed, the rooms behind them in full — each wall with what opens',
    'and stands on it and the stretches still free — and everything now wrong with',
    'the plan. update and remove take the --id the answer gave. Nothing has to be',
    'asked for; get-plan is only for the rooms a command did not touch.',
  ].join('\n')
}

/** The command list, asked for rather than always in front of the agent. */
export const helpText = describeCommands

/** How wide a line of the answer may be before its object is spread over several. */
const LINE = 100

/**
 * JSON that is read rather than parsed: anything short enough stays on one
 * line — a wall, a door, a clearance — and only what would not fit is opened
 * out. Pretty-printed, a room is two hundred lines of one number each; this
 * way it is twenty, and each of them says something.
 */
export function compactJson(value: unknown, indent = ''): string {
  const flat = JSON.stringify(value)
  if (flat === undefined) return 'null'
  if (flat.length + indent.length <= LINE || typeof value !== 'object' || value === null)
    return flat

  const inner = `${indent}  `
  if (Array.isArray(value)) {
    return `[\n${value.map((entry) => `${inner}${compactJson(entry, inner)}`).join(',\n')}\n${indent}]`
  }
  const entries = Object.entries(value).filter(([, entry]) => entry !== undefined)
  return `{\n${entries
    .map(([key, entry]) => `${inner}${JSON.stringify(key)}: ${compactJson(entry, inner)}`)
    .join(',\n')}\n${indent}}`
}
