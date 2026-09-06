export type Disposition = {
  id: string
  /** Habitable rooms: what the number in front of the plus counts. */
  rooms: number
  kitchen: 'kitchenette' | 'separate'
  /** Typical floor area of a new build, in m². */
  area: { from: number; to: number }
  /**
   * Where the range comes from. `market` was measured in the 2025/26 Czech
   * new-build market; `stepped` continues the same step past the sizes anybody
   * publishes figures for, and should be treated as a sketch.
   */
  source: 'market' | 'stepped'
  who: string
}

export const DISPOSITIONS: Disposition[] = [
  {
    id: '1+kk',
    rooms: 1,
    kitchen: 'kitchenette',
    area: { from: 20, to: 35 },
    source: 'market',
    who: 'one person',
  },
  {
    id: '1+1',
    rooms: 1,
    kitchen: 'separate',
    area: { from: 40, to: 55 },
    source: 'market',
    who: 'one person',
  },
  {
    id: '2+kk',
    rooms: 2,
    kitchen: 'kitchenette',
    area: { from: 40, to: 55 },
    source: 'market',
    who: 'a couple',
  },
  {
    id: '2+1',
    rooms: 2,
    kitchen: 'separate',
    area: { from: 55, to: 70 },
    source: 'market',
    who: 'a couple',
  },
  {
    id: '3+kk',
    rooms: 3,
    kitchen: 'kitchenette',
    area: { from: 55, to: 70 },
    source: 'market',
    who: 'a family with one child',
  },
  {
    id: '3+1',
    rooms: 3,
    kitchen: 'separate',
    area: { from: 70, to: 85 },
    source: 'market',
    who: 'a family with two children',
  },
  {
    id: '4+kk',
    rooms: 4,
    kitchen: 'kitchenette',
    area: { from: 70, to: 85 },
    source: 'market',
    who: 'a family with two children',
  },
  {
    id: '4+1',
    rooms: 4,
    kitchen: 'separate',
    area: { from: 85, to: 100 },
    source: 'stepped',
    who: 'a family with two or three children',
  },
  {
    id: '5+kk',
    rooms: 5,
    kitchen: 'kitchenette',
    area: { from: 95, to: 120 },
    source: 'stepped',
    who: 'a family with three children, or a house',
  },
  {
    id: '5+1',
    rooms: 5,
    kitchen: 'separate',
    area: { from: 110, to: 140 },
    source: 'stepped',
    who: 'a house',
  },
]

export const dispositionOf = (id: string): Disposition | undefined =>
  DISPOSITIONS.find((candidate) => candidate.id === id.toLowerCase().replace(/\s+/g, ''))

/**
 * What the standard asks of a dwelling, in m² and mm.
 *
 * ČSN 73 4301 and, since 1 July 2024, vyhláška 146/2024 Sb., which replaced
 * 268/2009 and 501/2006 under the new building act.
 */
export const STANDARD = {
  /** A habitable room at all. */
  habitableRoom: 8,
  /** The one room of a one-room flat, which has to hold everything. */
  onlyRoom: 16,
  /** At this and above, a kitchen counts as a habitable room rather than a corner. */
  kitchenAsRoom: 12,
  /** From this many habitable rooms the wc wants a room of its own, not a corner of the bathroom. */
  separateWcFrom: 3,
  /** A living room grows with the flat: 1-2 rooms, 3-4, and 5 or more. */
  livingRoom: { small: 16, medium: 18, large: 20 },
  /** Clear width of a passage; 1200 where anything stands along it. */
  passage: 1000,
  /** Clear floor in front of a door, so there is somewhere to stand to open it. */
  approach: 600,
  ceiling: { habitable: 2500, service: 2200 },
} as const

/** How many habitable rooms a dwelling of this many rooms is, as the notation counts them. */
export const notationFor = (rooms: number, kitchen: 'kitchenette' | 'separate'): string =>
  `${rooms}+${kitchen === 'kitchenette' ? 'kk' : '1'}`
