export type Disposition = {
  id: string
  rooms: number
  kitchen: 'kitchenette' | 'separate'
  area: { from: number; to: number }
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

export const STANDARD = {
  habitableRoom: 8,
  onlyRoom: 16,
  kitchenAsRoom: 12,
  separateWcFrom: 3,
  livingRoom: { small: 16, medium: 18, large: 20 },
  passage: 1000,
  approach: 600,
  ceiling: { habitable: 2500, service: 2200 },
} as const
