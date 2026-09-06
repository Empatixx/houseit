import { roomKindOf } from '@houseit/core/room-kinds'
import type { Problem, Rule } from './rule'

export const widths: Rule = ({ reports }) => {
  const problems: Problem[] = []
  for (const room of reports) {
    const kind = roomKindOf(room)
    if (kind?.minWidth === undefined) continue
    const across = Math.min(room.width, room.depth)
    if (across < kind.minWidth) {
      problems.push({
        code: 'room.too-narrow',
        severity: 'warning',
        room: room.name,
        message: `${room.name} is ${across} mm across, and a ${kind.label.toLowerCase()} wants ${kind.minWidth} mm`,
      })
    }
  }
  return problems
}
