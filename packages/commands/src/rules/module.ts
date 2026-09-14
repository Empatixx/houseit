import type { Discipline } from '@houseit/core/document'
import type { Rule } from './rule'

export type RuleModule = {
  discipline: Discipline
  rules: readonly Rule[]
}
