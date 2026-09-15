import { roomKindOf } from '@houseit/core/room-kinds'
import { doorsOf, type Problem, type Rule } from './rule'

export const privacy: Rule = ({ reports }) => {
  const problems: Problem[] = []
  const kinds = new Map(reports.map((room) => [room.name, roomKindOf(room)] as const))
  for (const room of reports) {
    const kind = kinds.get(room.name)
    if (!kind || !['bedroom', 'bathroom', 'half-bath'].includes(kind.id)) continue
    const interior = doorsOf(room).filter(
      (door) => door.to !== 'outside' && !kinds.get(door.to)?.outdoor,
    )
    if (interior.length === 0) continue
    const onlyPublic = interior.every((door) => kinds.get(door.to ?? '')?.public)
    if (onlyPublic) {
      problems.push({
        code: 'room.opens-to-public',
        severity: 'warning',
        room: room.name,
        message: `${room.name} opens straight into ${interior.map((door) => door.to).join(' and ')} — a ${kind.label.toLowerCase()} wants a hall between`,
      })
    }
  }
  return problems
}
