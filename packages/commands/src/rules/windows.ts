import { roomKindOf } from '@houseit/core/room-kinds'
import type { Rule } from './rule'

/** A room somebody lives in has a window. */
export const windows: Rule = ({ reports }) =>
  reports
    .filter(
      (room) =>
        roomKindOf(room)?.needsWindow &&
        !room.openings.some((opening) => opening.kind === 'window'),
    )
    .map((room) => ({
      code: 'window.missing',
      severity: 'warning' as const,
      room: room.name,
      message: `${room.name} has no window`,
    }))
