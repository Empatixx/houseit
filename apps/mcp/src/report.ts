import type { ExecResult } from '@houseit/bridge/contract'
import { guidelinesText as guidelines } from '@houseit/commands/guidelines'
import { describeCommands } from '@houseit/commands/registry'

export function report(result: ExecResult): string {
  if (!result.ok) return result.error

  const plan = result.project?.name ?? 'the plan'
  return `${plan}\n${compactJson(result.answer)}`
}

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
    '',
    'Call it with `guidelines` on its own before laying a dwelling out: how the',
    'rooms of a flat or a house go together, what each size of dwelling holds, and',
    'the dimensions every plan here is checked against.',
  ].join('\n')
}

export const helpText = describeCommands

export const guidelinesText = guidelines

const LINE = 100

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
