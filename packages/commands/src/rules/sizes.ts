import { roomKindOf } from '@houseit/core/room-kinds'
import { NARROWEST, narrowParts } from '@houseit/geometry/narrow'
import type { Problem, Rule } from './rule'

export const sizes: Rule = ({ doc, level, reports }) => {
  const problems: Problem[] = []
  for (const part of narrowParts(doc, level)) {
    problems.push({
      code: 'room.narrow-part',
      severity: 'error',
      ...(part.room ? { room: part.room } : {}),
      message: `${part.room ?? 'a space between walls'} has a strip narrower than ${NARROWEST} mm (${(part.lost / 1e6).toFixed(2)} m²) that nobody can use or get into — move the wall that leaves it`,
    })
  }
  for (const room of reports) {
    const kind = roomKindOf(room)
    if (!kind) continue
    if (room.areaM2 < kind.minArea) {
      problems.push({
        code: 'room.too-small',
        severity: 'warning',
        room: room.name,
        message: `${room.name} is ${room.areaM2} m², and a ${kind.label.toLowerCase()} wants ${kind.minArea} m²`,
      })
    }
    const ratio = Math.max(room.width, room.depth) / Math.max(1, Math.min(room.width, room.depth))
    if (!kind.passage && !kind.outdoor && ratio > 3) {
      problems.push({
        code: 'room.bad-ratio',
        severity: 'warning',
        room: room.name,
        message: `${room.name} is ${room.width} by ${room.depth} mm — ${ratio.toFixed(1)} times as long as it is wide`,
      })
    }
  }
  return problems
}
