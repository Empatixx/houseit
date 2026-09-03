import type { ExecResult, RoomSummary } from '@houseit/bridge/contract'
import { describeCommands } from '@houseit/commands/registry'

const squareMetres = (area: number) => (area / 1_000_000).toFixed(1)

const roomLine = (room: RoomSummary) =>
  `  ${room.name ?? '(unnamed)'} — ${squareMetres(room.area)} m²`

/**
 * What the agent reads back. Rooms rather than raw walls: the derived rooms are
 * what the plan means, and they are what a next command will be reasoned from.
 *
 * A script that asked something — `describe`, `measure` — gets its answers
 * instead, as JSON, one after another. The answers already say what the plan
 * holds, and a room count on top of them would be noise.
 */
export function report(result: ExecResult): string {
  if (!result.ok) return result.error

  if (result.output.length > 0) {
    return result.output.map((entry) => compactJson(entry)).join('\n')
  }

  if (result.rooms.length === 0) {
    return 'Done. The plan has no rooms yet — walls must close before a room exists.'
  }

  return [`Done. ${result.rooms.length} room(s):`, ...result.rooms.map(roomLine)].join('\n')
}

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

/**
 * Generated from the command registry rather than written by hand, so the agent
 * can never be told about a command that no longer exists.
 */
export function toolDescription(): string {
  return [
    'Edit the floor plan open in the browser. Takes one or more commands, one per',
    'line, applied as a single transaction — if any line fails, nothing changes.',
    'Lines starting with # are comments. Lengths are in millimetres, or with a unit: 3.6m.',
    '',
    'Rooms are cut out of rooms. floor-shape draws the outline of the floor, one room',
    'covering it; add-room cuts a strip off a side of a room, a box out of a corner, any',
    'shape by its corners (--points "0,0; 4m,0; 4m,3m; 2m,3m; 2m,5m; 0,5m", from the',
    'south-west corner of the floor), or by a walk of legs from a side (--walk "3m s, 4m e").',
    'describe gives every room, wall, door, window and thing an id — r1, w12, o3, f7. Any',
    'command takes --wall w12 where it takes --side, which is how the second north wall of',
    'an L is reached, and --id f7 where it takes --room --type --nth. --along is a fraction',
    'of the wall (0 at its west or south end, 1 at the other) or a length from that end:',
    '0.5, 2.4m, 2400, -1m for a metre from the far end.',
    '',
    'describe, measure and check-plan change nothing and answer with JSON, and the',
    'last of them in a script also comes back with a picture of what it looked at —',
    'the room picked out with its dimensions, the thing with its clearances. Put one',
    'at the end of a script to see what the script did, or on its own to read the',
    'plan. check-plan lists what is wrong: rooms nobody can reach, doors that cannot',
    'open, rooms too small or dark for what they are called.',
    '',
    'Commands:',
    '',
    describeCommands(),
  ].join('\n')
}
