import type { HouseDocument, Level } from './document'

export const levelsOf = (doc: HouseDocument): Level[] =>
  Object.values(doc.levels).sort((one, other) => one.elevation - other.elevation)

export function levelAbove(doc: HouseDocument, level: string): Level | undefined {
  const stack = levelsOf(doc)
  const at = stack.findIndex((candidate) => candidate.id === level)
  return at === -1 ? undefined : stack[at + 1]
}

export function levelBelow(doc: HouseDocument, level: string): Level | undefined {
  const stack = levelsOf(doc)
  const at = stack.findIndex((candidate) => candidate.id === level)
  return at <= 0 ? undefined : stack[at - 1]
}

const RISER = { least: 150, most: 200, wanted: 175 }

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

export const SLAB = 250

export const HEADROOM = 2100
