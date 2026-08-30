/**
 * The things that go in a room.
 *
 * A type is what something is and how big it usually is — never how it is drawn.
 * The drawing is a skeleton in the editor and a surface from `surfaces.ts`, and
 * keeping all three apart is what lets one `table` be oak, walnut, marble or
 * glass without there being four tables.
 */
export type ObjectType = {
  id: string
  label: string
  /** What it is if nobody says otherwise, in millimetres. */
  size: { width: number; depth: number }
  /** The surfaces this thing is ever finished in. */
  surfaces: readonly string[]
  /** Where it goes when no side is named. */
  stands: 'wall' | 'free'
  /** Places at a table. Ignored by everything without them. */
  seats?: number
  /**
   * Which layer of the room it takes up. Things only keep clear of things on their
   * own layer, and a layer is drawn over the one below it.
   *
   * 'under' lies on the floor for other things to stand on: a rug does not take up
   * a room the way a table does, so it neither moves aside for one nor pushes one
   * out of the way. 'over' stands on the furniture rather than on the floor: a
   * television and the console it sits on want the very same stretch of wall, and
   * queueing them up along it puts the television on the floor beside its stand.
   * Everything else stands on the floor, which is what leaving this out means.
   */
  layer?: Layer
  /**
   * Stands shoulder to shoulder with its neighbours instead of spreading out along
   * the wall.
   *
   * A kitchen is a run: units, sink, cooker and fridge butt up against one another
   * and the gaps go at the ends. Everything else is happier spread out — two sofas
   * pushed together is not a living room — so this is the exception, said out loud.
   */
  abuts?: boolean
  /**
   * How far past its own size the thing spreads, in millimetres on every side.
   *
   * A table's size is its top, but the chairs tucked round it need floor as well,
   * and a plan that ignores them puts the table against a wall nobody can sit at.
   * Everything else is the size it says it is, and the drawing is held to that by
   * a test.
   */
  reach?: number
}

/** Under the floor's furniture, on it, or on top of it. */
export type Layer = 'under' | 'floor' | 'over'

const TOP = ['oak', 'walnut', 'marble', 'glass', 'white', 'black', 'steel'] as const
const SOFT = ['fabric', 'grey', 'blue', 'green', 'linen', 'rust'] as const
/** Rugs take the plain weaves and the patterned ones alike. */
const RUG = [...SOFT, 'dots', 'stripes', 'check'] as const
/** Televisions come in one colour so far, and that colour is black. */
const BLACK = ['black'] as const
/** A cabinet is furniture like any other, and dark wood before anything else. */
const CABINET = ['walnut', 'oak', 'white', 'black', 'marble', 'steel'] as const
/** Sanitary ware: glazed white, or the black somebody puts in a downstairs loo. */
const CERAMIC = ['white', 'black'] as const
/** White goods, which are mostly not white any more. */
const APPLIANCE = ['steel', 'white', 'graphite', 'black'] as const
/** Bedding: what a bed is seen as from above is the cover on it, not the frame. */
const BEDDING = ['white', 'linen', 'grey', 'blue', 'green', 'fabric', 'rust'] as const
/** A staircase is joinery or stonework: what a floor is laid in, standing on edge. */
const STAIR = ['oak', 'walnut', 'marble', 'white', 'black', 'steel'] as const
const SEAT = [
  'oak',
  'walnut',
  'white',
  'black',
  'fabric',
  'grey',
  'blue',
  'green',
  'linen',
  'rust',
] as const

export const OBJECT_TYPES: readonly ObjectType[] = [
  {
    id: 'table',
    label: 'Dining table',
    size: { width: 1600, depth: 900 },
    surfaces: TOP,
    stands: 'free',
    seats: 6,
    reach: 440,
  },
  {
    id: 'table-round',
    label: 'Round table',
    size: { width: 1200, depth: 1200 },
    surfaces: TOP,
    stands: 'free',
    seats: 4,
    reach: 440,
  },
  {
    id: 'bedside',
    label: 'Bedside table',
    size: { width: 460, depth: 400 },
    surfaces: ['oak', 'walnut', 'white', 'black', 'marble'],
    stands: 'wall',
  },
  {
    id: 'chair',
    label: 'Chair',
    size: { width: 460, depth: 500 },
    surfaces: SEAT,
    stands: 'free',
  },
  {
    id: 'sofa',
    label: 'Sofa',
    size: { width: 2100, depth: 900 },
    surfaces: SOFT,
    stands: 'wall',
    seats: 3,
  },
  {
    id: 'armchair',
    label: 'Armchair',
    size: { width: 900, depth: 850 },
    surfaces: SOFT,
    stands: 'free',
  },
  {
    id: 'rug',
    label: 'Rug',
    size: { width: 2400, depth: 1700 },
    // The fringe hangs off the ends, so a rug wants a little more floor than its own.
    reach: 110,
    surfaces: RUG,
    stands: 'free',
    layer: 'under',
  },
  {
    id: 'rug-small',
    label: 'Small rug',
    size: { width: 1400, depth: 900 },
    // The fringe hangs off the ends, so a rug wants a little more floor than its own.
    reach: 110,
    surfaces: RUG,
    stands: 'free',
    layer: 'under',
  },
  {
    id: 'plant',
    label: 'Plant',
    size: { width: 700, depth: 700 },
    // Leaves are thrown a little past the pot's own spread; that is what a leaf does.
    reach: 80,
    surfaces: ['green'],
    stands: 'free',
  },
  {
    id: 'plant-large',
    label: 'Large plant',
    size: { width: 1100, depth: 1100 },
    // Leaves are thrown a little past the pot's own spread; that is what a leaf does.
    reach: 80,
    surfaces: ['green'],
    stands: 'free',
  },
  {
    id: 'tv-stand',
    label: 'TV stand',
    // Deeper than the carcass by the handles standing off the front, like a
    // kitchen unit — that reach is the only part of them a plan can show.
    size: { width: 1600, depth: 464 },
    surfaces: CABINET,
    stands: 'wall',
  },
  {
    id: 'tv-stand-small',
    label: 'Small TV stand',
    size: { width: 1100, depth: 444 },
    surfaces: CABINET,
    stands: 'wall',
  },
  {
    id: 'tv',
    label: 'Television',
    size: { width: 1250, depth: 220 },
    surfaces: BLACK,
    stands: 'wall',
    layer: 'over',
  },
  {
    id: 'toilet',
    label: 'Toilet',
    size: { width: 380, depth: 700 },
    surfaces: CERAMIC,
    stands: 'wall',
  },
  {
    id: 'bath',
    label: 'Bath',
    size: { width: 1700, depth: 750 },
    surfaces: CERAMIC,
    stands: 'wall',
  },
  {
    id: 'shower',
    label: 'Shower',
    // Square, and the tray is the whole of its floor. The glass round it stands
    // on the tray rather than past it, so this is all the room it takes.
    size: { width: 900, depth: 900 },
    surfaces: CERAMIC,
    stands: 'wall',
  },
  {
    id: 'basin',
    label: 'Basin',
    size: { width: 600, depth: 450 },
    surfaces: CERAMIC,
    stands: 'wall',
  },
  {
    id: 'vanity',
    label: 'Vanity unit',
    size: { width: 900, depth: 500 },
    surfaces: CABINET,
    stands: 'wall',
  },
  {
    id: 'cabinet',
    label: 'Kitchen unit',
    // Six hundred deep like every base unit, and the rest is the handles standing
    // off the front, which is the only part of them a plan ever shows.
    size: { width: 600, depth: 644 },
    surfaces: CABINET,
    stands: 'wall',
    abuts: true,
  },
  {
    id: 'sink',
    label: 'Sink unit',
    size: { width: 800, depth: 644 },
    surfaces: CABINET,
    stands: 'wall',
    abuts: true,
  },
  {
    id: 'cooker',
    label: 'Cooker',
    // Proud of the run by a centimetre or two, like the fridge: it is how you tell
    // the appliances from the cupboards at a glance.
    size: { width: 600, depth: 700 },
    surfaces: APPLIANCE,
    stands: 'wall',
    abuts: true,
  },
  {
    id: 'fridge',
    label: 'Fridge',
    size: { width: 600, depth: 700 },
    surfaces: APPLIANCE,
    stands: 'wall',
    abuts: true,
  },
  {
    id: 'bin',
    label: 'Waste bin',
    size: { width: 300, depth: 300 },
    surfaces: CERAMIC,
    // Against a wall. Nobody stands a bin in the middle of the floor, and a plan
    // that does reads as a mistake rather than as a choice.
    stands: 'wall',
  },
  {
    id: 'toilet-roll',
    label: 'Toilet roll holder',
    size: { width: 260, depth: 180 },
    surfaces: CERAMIC,
    stands: 'wall',
  },
  {
    id: 'bed',
    label: 'Double bed',
    size: { width: 1600, depth: 2050 },
    surfaces: BEDDING,
    stands: 'wall',
    // No reach, on purpose. Room round a bed was the first thought and it is
    // wrong: what goes in the space either side of a bed is the bedside tables,
    // and reserving it as clearance leaves them nowhere to stand.
  },
  {
    id: 'bed-single',
    label: 'Single bed',
    size: { width: 900, depth: 2050 },
    surfaces: BEDDING,
    stands: 'wall',
  },
  {
    id: 'stairs-up',
    label: 'Stairs up',
    // A storey's worth of run: fifteen goings of a quarter-metre, and wide enough
    // for one person with a hand on the rail. The long side lies along the wall.
    size: { width: 3800, depth: 1000 },
    surfaces: STAIR,
    stands: 'wall',
  },
  {
    id: 'stairs-down',
    label: 'Stairs down',
    // The same flight, walked the same way and falling instead of climbing. Two
    // entries rather than one with a direction: which way it goes is what the
    // drawing is *about*, and a plan is read, not queried.
    size: { width: 3800, depth: 1000 },
    surfaces: STAIR,
    stands: 'wall',
  },
  {
    id: 'stairs-turn-up',
    label: 'Stairs up, turning',
    // The same storey doubled back on itself: two flights of eight side by side
    // with the wall between them, and the landing across the end where you turn.
    // Half the run of a straight flight, and it wants the room to be that deep.
    size: { width: 3000, depth: 2150 },
    surfaces: STAIR,
    stands: 'wall',
  },
  {
    id: 'stairs-turn-down',
    label: 'Stairs down, turning',
    size: { width: 3000, depth: 2150 },
    surfaces: STAIR,
    stands: 'wall',
  },
  {
    id: 'tv-large',
    label: 'Large television',
    size: { width: 1700, depth: 240 },
    surfaces: BLACK,
    stands: 'wall',
    layer: 'over',
  },
] as const

export const OBJECT_TYPE_IDS = OBJECT_TYPES.map((entry) => entry.id)

export const objectType = (id: string): ObjectType | undefined =>
  OBJECT_TYPES.find((entry) => entry.id === id)

/** Which layer a thing takes up, with the floor as what most things mean. */
export const layerOf = (id: string): Layer => objectType(id)?.layer ?? 'floor'
