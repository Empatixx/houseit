import type { HouseDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { approach } from './rules/approach'
import { doors } from './rules/doors'
import { kitchens } from './rules/kitchens'
import { privacy } from './rules/privacy'
import { reach } from './rules/reach'
import type { Problem, Rule, Storey } from './rules/rule'
import { sizes } from './rules/sizes'
import { stairs } from './rules/stairs'
import { standing } from './rules/standing'
import { wc } from './rules/wc'
import { widths } from './rules/widths'
import { windows } from './rules/windows'
import { surveyLevel } from './survey'

const RULES: Rule[] = [
  reach,
  privacy,
  sizes,
  widths,
  windows,
  kitchens,
  doors,
  approach,
  standing,
  stairs,
  wc,
]

export type { Problem } from './rules/rule'

export function checkLevel(doc: HouseDocument, level: string): Problem[] {
  const storey: Storey = {
    doc,
    level,
    reports: surveyLevel(doc, level).rooms,
    rooms: roomsOf(doc, level),
  }
  return RULES.flatMap((rule) => rule(storey)).sort((one, other) => rank(one) - rank(other))
}

const rank = (problem: Problem) => (problem.severity === 'error' ? 0 : 1)
