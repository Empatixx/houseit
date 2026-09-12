import { roomKindOf } from '@houseit/core/room-kinds'
import type { Rule } from './rule'

export const windows: Rule = ({ reports }) =>
  reports
    .filter(
      (room) =>
        roomKindOf(room)?.needsWindow &&
        !room.openings.some(
          (opening) =>
            opening.kind === 'window' ||
            opening.panels?.some((panel) => panel.kind !== 'door' && panel.kind !== 'opaque'),
        ),
    )
    .map((room) => ({
      code: 'window.missing',
      severity: 'warning' as const,
      room: room.name,
      message: `${room.name} has no window`,
    }))
