import { approach } from './approach'
import { doors } from './doors'
import { kitchens } from './kitchens'
import type { RuleModule } from './module'
import { privacy } from './privacy'
import { reach } from './reach'
import { sizes } from './sizes'
import { stairs } from './stairs'
import { standing } from './standing'
import { wc } from './wc'
import { widths } from './widths'
import { windows } from './windows'

export const RULE_MODULES: readonly RuleModule[] = [
  {
    discipline: 'architecture',
    rules: [
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
    ],
  },
]
