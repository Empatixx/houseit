export type Need = { what: string; types: RegExp }

const BED = /(^|-)bed$|^bed-|^crib$/
const CLOTHES = /wardrobe|dresser|clothing-rack|built-in-shelf/
const SEATING = /^sofa-|lounge-chair|club-chair|chair-ottoman/

export const ROOM_NEEDS: Readonly<Record<string, readonly Need[]>> = {
  bedroom: [
    { what: 'a bed', types: BED },
    { what: 'somewhere for clothes', types: CLOTHES },
  ],
  living: [
    { what: 'somewhere to sit', types: SEATING },
    { what: 'a low table', types: /coffee-table|side-table/ },
  ],
  'living-kitchen': [
    { what: 'somewhere to sit', types: SEATING },
    { what: 'a kitchen run', types: /^kitchen-(?!sink)|^counter-/ },
  ],
  dining: [{ what: 'a dining table', types: /^dining-|^table-|^island-/ }],
  bathroom: [
    { what: 'a washbasin', types: /vanity/ },
    { what: 'a bath or a shower', types: /bathtub|shower/ },
  ],
  'half-bath': [{ what: 'a toilet', types: /toilet/ }],
  laundry: [{ what: 'a washing machine', types: /washer/ }],
  office: [
    { what: 'a desk', types: /desk/ },
    { what: 'a chair', types: /chair/ },
  ],
  entry: [{ what: 'somewhere for coats', types: /coat-stand|wardrobe|bench|built-in-shelf/ }],
  'walk-in': [{ what: 'hanging or shelves', types: CLOTHES }],
}

export const FACES_ROOM =
  /^sofa-|lounge-chair|club-chair|chair-ottoman|media-unit|television|tv-stand/

export const CHAIR = /^office-chair$|^dining-chair$/
export const SEATS_AT = /desk|^dining-|^table-|^island-|^bar/

export const SCREEN = /media-unit|television|tv-stand/
export const WATCHES = /^sofa-/

export const KITCHEN_RUN = /^kitchen-(?!sink)|^counter-/
export const TOILET = /toilet/
export const FRIDGE = /refrigerator/
export const WASHER = /washer/

export type UseSpace = {
  name: string
  types: RegExp
  front?: number
  sides?: number
  bothSides?: (thing: { width: number }) => boolean
  why: string
  allows?: RegExp
}

export const USE_SPACE: readonly UseSpace[] = [
  {
    name: 'a bed',
    types: BED,
    sides: 600,
    bothSides: (bed) => bed.width >= 1400,
    why: 'to get in',
    allows: /nightstand/,
  },
  { name: 'a wardrobe or dresser', types: /wardrobe|dresser/, front: 700, why: 'to open it' },
  { name: 'a kitchen run', types: KITCHEN_RUN, front: 1000, why: 'to work at it' },
  {
    name: 'a sink, stove or dishwasher',
    types: /^kitchen-sink$|^stove$|^dishwasher$/,
    front: 1000,
    why: 'to work at it',
  },
  { name: 'a fridge', types: FRIDGE, front: 900, why: 'to open its door' },
  { name: 'an island', types: /^island-/, front: 1000, why: 'to walk round it' },
  { name: 'a toilet', types: TOILET, front: 600, why: 'to sit down' },
  { name: 'a washbasin', types: /vanity/, front: 600, why: 'to stand at it' },
  { name: 'a bath or shower', types: /bathtub|shower/, front: 600, why: 'to step in' },
  { name: 'a washing machine', types: WASHER, front: 800, why: 'to load it' },
  { name: 'a desk', types: /desk/, front: 800, why: 'to sit at it', allows: /chair/ },
]

export const spaceToUse = (type: string): UseSpace | undefined =>
  USE_SPACE.find((space) => space.types.test(type))

export function sleepersOf(thing: { type: string; width: number }): number {
  if (!BED.test(thing.type)) return 0
  return thing.type !== 'crib' && thing.width >= 1400 ? 2 : 1
}

export function seatsOf(thing: { type: string; seats?: number | undefined }): number {
  if (thing.seats !== undefined) return thing.seats
  if (thing.type === 'outdoor-dining') return 0
  const counted = /^(?:dining|island)-(?:[a-z]+-)?(\d+)/.exec(thing.type)
  if (counted) return Number(counted[1])
  if (thing.type === 'dining-chair') return 1
  return 0
}
