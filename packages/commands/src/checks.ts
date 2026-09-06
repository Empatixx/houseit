import type { HouseDocument } from '@houseit/core/document'
import { roomsOf } from '@houseit/geometry/rooms'
import { doors } from './rules/doors'
import { kitchens } from './rules/kitchens'
import { privacy } from './rules/privacy'
import { reach } from './rules/reach'
import type { Problem, Rule, Storey } from './rules/rule'
import { sizes } from './rules/sizes'
import { stairs } from './rules/stairs'
import { standing } from './rules/standing'
import { windows } from './rules/windows'
import { surveyLevel } from './survey'

/**
 * Reads the plan for trouble: a room nobody can get to, a bedroom opening
 * straight into the kitchen, a door that cannot swing for the sofa in front
 * of it, a laundry too small to be one, a living room with no window. Empty is
 * what a finished plan gets.
 *
 * Not a command. It runs after every command that changes anything, and the
 * list rides along in the answer — so the command that put the chair in the
 * doorway is the one that says the door cannot open, rather than a separate
 * question asked later by somebody who suspected it already.
 *
 * The rules are the ones the reference reviews a plan by and the ones this plan's own
 * commands already keep, so nothing is refused here that a command would have
 * allowed without a word. What sort of room a room is comes from its name, for
 * now: see `room-kinds`.
 *
 * One rule to a file, in `rules`, all of them the same shape and none of them
 * knowing about the others. This is the whole of the list, so a rule nobody
 * added here is a rule nobody runs — and adding one is adding a file and a
 * line, not a branch inside something that already does seven other things.
 */
const RULES: Rule[] = [reach, privacy, sizes, windows, kitchens, doors, standing, stairs]

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
