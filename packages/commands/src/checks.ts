import type { HouseDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import type { RuleModule } from './rules/module'
import { RULE_MODULES } from './rules/modules'
import type { Problem, Storey } from './rules/rule'
import { surveyLevel } from './survey'

export type { Problem } from './rules/rule'

export function checkLevel(doc: HouseDocument, level: string): Problem[] {
  const storey: Storey = {
    doc,
    level,
    reports: surveyLevel(doc, level).rooms,
    rooms: roomsOf(doc, level),
  }
  return checkStorey(storey)
}

export function checkStorey(
  storey: Storey,
  modules: readonly RuleModule[] = RULE_MODULES,
): Problem[] {
  return modules
    .flatMap((module) => module.rules.flatMap((rule) => rule(storey)))
    .sort((one, other) => rank(one) - rank(other))
}

const rank = (problem: Problem) => (problem.severity === 'error' ? 0 : 1)
