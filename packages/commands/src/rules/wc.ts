import { STANDARD } from '@houseit/core/dispositions'
import { levelsOf } from '@houseit/core/levels'
import { roomKindOf } from '@houseit/core/room-kinds'
import { roomsOf } from '@houseit/geometry/rooms'
import type { Rule } from './rule'

const HABITABLE = ['bedroom', 'living', 'dining', 'office']

export const wc: Rule = ({ doc, level }) => {
  const storeys = levelsOf(doc)
  if (storeys[0]?.id !== level) return []

  const everywhere = storeys.flatMap((storey) => roomsOf(doc, storey.id))
  const habitable = everywhere.filter((room) => HABITABLE.includes(roomKindOf(room)?.id ?? ''))
  if (habitable.length < STANDARD.separateWcFrom) return []
  if (everywhere.some((room) => roomKindOf(room)?.id === 'half-bath')) return []

  return [
    {
      code: 'flat.wc-not-separate',
      severity: 'warning',
      message: `${habitable.length} habitable rooms and no wc of its own — from ${STANDARD.separateWcFrom} the standard wants one out of the bathroom`,
    },
  ]
}
