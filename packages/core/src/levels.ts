import type { HouseDocument, Level } from './document'

/**
 * The storeys of a house, and which is above which.
 *
 * A level is not a layer to switch on and off: it is a floor somebody stands on,
 * at a height above the one below it. So the order is the order they are built
 * in — by elevation — and everything about a storey that is not written down
 * (which is above it, how far up it is, whether a staircase has anywhere to go)
 * is read from that order rather than stored a second time.
 */

/** Every storey, lowest first. */
export const levelsOf = (doc: HouseDocument): Level[] =>
  Object.values(doc.levels).sort((one, other) => one.elevation - other.elevation)

/** The storey above this one, if the house has one. */
export function levelAbove(doc: HouseDocument, level: string): Level | undefined {
  const stack = levelsOf(doc)
  const at = stack.findIndex((candidate) => candidate.id === level)
  return at === -1 ? undefined : stack[at + 1]
}

/** The storey below this one, which is what a plan is drawn over. */
export function levelBelow(doc: HouseDocument, level: string): Level | undefined {
  const stack = levelsOf(doc)
  const at = stack.findIndex((candidate) => candidate.id === level)
  return at <= 0 ? undefined : stack[at - 1]
}

/** Which storey this is, counting the ground floor as the first. */
export function storeyOf(doc: HouseDocument, level: string): number {
  return levelsOf(doc).findIndex((candidate) => candidate.id === level) + 1
}

/**
 * A comfortable riser, in millimetres, and the range a building is allowed.
 *
 * A flight is a whole number of equal risers from one floor to the next, so the
 * height of the storey decides how many there are — and a staircase drawn with
 * any other number is a drawing of a staircase nobody could climb.
 */
const RISER = { least: 150, most: 200, wanted: 175 }

/**
 * How a flight climbs a storey: how many risers, how high each is, and how deep
 * each tread has to be for the going to be walkable.
 *
 * The rule of thumb every stair is built to: two risers plus a going comes to
 * about 630 mm, which is a pace. A steep flight gets deep treads and a shallow
 * one shallow ones, and both are climbable; only the arithmetic changes.
 */
export function flightOf(height: number): { risers: number; riser: number; going: number } {
  const wanted = Math.max(2, Math.round(height / RISER.wanted))
  const risers = [wanted, wanted + 1, wanted - 1].find((count) => {
    const each = height / count
    return each >= RISER.least && each <= RISER.most
  })
  const count = risers ?? wanted
  const riser = Math.round(height / count)
  return { risers: count, riser, going: Math.round(630 - 2 * riser) }
}
