import type { ExecResult, RoomSummary } from '@houseit/bridge/contract'
import { describeCommands } from '@houseit/commands/registry'

const squareMetres = (area: number) => (area / 1_000_000).toFixed(1)

const roomLine = (room: RoomSummary) =>
  `  ${room.name ?? '(unnamed)'} — ${squareMetres(room.area)} m²`

/**
 * What the agent reads back. Rooms rather than raw walls: the derived rooms are
 * what the plan means, and they are what a next command will be reasoned from.
 */
export function report(result: ExecResult): string {
  if (!result.ok) return result.error

  if (result.rooms.length === 0) {
    return 'Done. The plan has no rooms yet — walls must close before a room exists.'
  }

  return [`Done. ${result.rooms.length} room(s):`, ...result.rooms.map(roomLine)].join('\n')
}

/**
 * Generated from the command registry rather than written by hand, so the agent
 * can never be told about a command that no longer exists.
 */
export function toolDescription(): string {
  return [
    'Edit the floor plan open in the browser. Takes one or more commands, one per',
    'line, applied as a single transaction — if any line fails, nothing changes.',
    'Lines starting with # are comments. Lengths are in millimetres.',
    '',
    'Commands:',
    '',
    describeCommands(),
  ].join('\n')
}
